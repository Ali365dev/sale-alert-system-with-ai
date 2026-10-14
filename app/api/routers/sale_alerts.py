"""Per-device product/brand sale watchlist — public, keyed by device_id."""
from __future__ import annotations

import threading

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse

from database.db import get_session
from database.models import SaleAlert
from services.sale_alert_analyze import analyze_product_url
from services.sale_alert_brand import enrich_analyze_with_brand
from services.sale_alert_service import check_product_alert, evaluate_alert_on_create
from services.sale_alert_validation import (
    is_http_url,
    normalize_http_url,
    validate_create_payload,
    validate_device_id,
    validate_patch_payload,
)

router = APIRouter(prefix="/api/sale-alerts", tags=["sale-alerts"])

_UPDATABLE = frozenset({
    "alert_type", "status", "product_name", "brand_name", "product_url", "image_url",
    "current_price", "original_price", "sku", "variant", "condition_type", "custom_pct", "target_price",
    "watch_below_price", "notify_push", "notify_email", "notify_in_app",
})


def _alert_to_dict(a: SaleAlert) -> dict:
    return {
        "id": a.id,
        "device_id": a.device_id,
        "alert_type": a.alert_type,
        "status": a.status,
        "product_name": a.product_name,
        "brand_name": a.brand_name,
        "product_url": a.product_url,
        "image_url": a.image_url,
        "current_price": a.current_price,
        "original_price": a.original_price,
        "sku": a.sku,
        "variant": a.variant,
        "condition_type": a.condition_type,
        "custom_pct": a.custom_pct,
        "target_price": a.target_price,
        "watch_below_price": a.watch_below_price,
        "notify_push": a.notify_push,
        "notify_email": a.notify_email,
        "notify_in_app": a.notify_in_app,
        "last_checked_at": a.last_checked_at.isoformat() if a.last_checked_at else None,
        "last_triggered_at": a.last_triggered_at.isoformat() if a.last_triggered_at else None,
        "triggered_message": a.triggered_message,
        "triggered_deal_url": a.triggered_deal_url,
        "check_fail_count": int(a.check_fail_count or 0),
        "last_check_error": a.last_check_error,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


def _bad_request(message: str) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=400)


def _get_owned_alert(session, alert_id: int, device_id: str) -> SaleAlert | None:
    return (
        session.query(SaleAlert)
        .filter(SaleAlert.id == alert_id, SaleAlert.device_id == device_id)
        .first()
    )


def _summary_counts(alerts: list[SaleAlert]) -> dict:
    return {
        "active": sum(1 for a in alerts if a.status == "active"),
        "products": sum(1 for a in alerts if a.alert_type == "product"),
        "brands": sum(1 for a in alerts if a.alert_type == "brand"),
        "triggered": sum(1 for a in alerts if a.status == "triggered"),
    }


def _schedule_evaluate(alert_id: int) -> None:
    def _run():
        try:
            evaluate_alert_on_create(alert_id)
        except Exception:
            from config import logger

            logger.exception("Sale alert evaluate-on-create failed for %s", alert_id)

    threading.Thread(target=_run, daemon=True).start()


@router.get("")
def list_sale_alerts(device_id: str = Query(...)):
    device_id, err = validate_device_id(device_id)
    if err:
        return _bad_request(err)

    with get_session() as session:
        alerts = (
            session.query(SaleAlert)
            .filter(SaleAlert.device_id == device_id)
            .order_by(SaleAlert.created_at.desc())
            .all()
        )
        return {"alerts": [_alert_to_dict(a) for a in alerts], "summary": _summary_counts(alerts)}


@router.post("")
def create_sale_alert(body: dict = Body(default={})):
    payload, err = validate_create_payload(body or {})
    if err:
        return _bad_request(err)

    # Fill missing product image from catalog brand logo; record unknown brands.
    brand_hint = {
        "ok": True,
        "brand_name": payload.get("brand_name"),
        "product_url": payload.get("product_url"),
        "image_url": payload.get("image_url"),
        "product_name": payload.get("product_name"),
        "current_price": payload.get("current_price"),
    }
    enriched = enrich_analyze_with_brand(
        brand_hint,
        device_id=payload.get("device_id"),
        record_missing=payload.get("alert_type") == "product",
    )
    if enriched.get("image_url") and not payload.get("image_url"):
        payload["image_url"] = enriched["image_url"]
    if enriched.get("brand_name") and not payload.get("brand_name"):
        payload["brand_name"] = enriched["brand_name"]

    with get_session() as session:
        a = SaleAlert(**payload)
        session.add(a)
        session.flush()
        response = _alert_to_dict(a)
        alert_id = a.id
        status = a.status

    if status == "active":
        _schedule_evaluate(alert_id)
    return JSONResponse(response, status_code=201)


@router.post("/analyze-product")
def analyze_product(body: dict = Body(default={})):
    body = body or {}
    url = (body.get("url") or "").strip()
    if not url:
        return _bad_request("url is required")
    if not is_http_url(url):
        return _bad_request("url must be a valid http(s) URL")
    device_id = (body.get("device_id") or "").strip() or None
    result = analyze_product_url(normalize_http_url(url) or url)
    return enrich_analyze_with_brand(result, device_id=device_id, record_missing=True)


@router.post("/{alert_id}/check")
def check_sale_alert(alert_id: int, body: dict = Body(default={})):
    """Manually recheck a product alert (also useful for QA)."""
    body = body or {}
    device_id, err = validate_device_id(body.get("device_id"))
    if err:
        return _bad_request(err)

    with get_session() as session:
        a = _get_owned_alert(session, alert_id, device_id)
        if a is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        if a.alert_type != "product":
            return _bad_request("only product alerts can be rechecked")

    result = check_product_alert(alert_id, notify=True)
    with get_session() as session:
        a = _get_owned_alert(session, alert_id, device_id)
        alert_dict = _alert_to_dict(a) if a else None
    return {"result": result, "alert": alert_dict}


@router.get("/{alert_id}")
def get_sale_alert(alert_id: int, device_id: str = Query(...)):
    device_id, err = validate_device_id(device_id)
    if err:
        return _bad_request(err)

    with get_session() as session:
        a = _get_owned_alert(session, alert_id, device_id)
        if a is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        return _alert_to_dict(a)


@router.patch("/{alert_id}")
def update_sale_alert(alert_id: int, body: dict = Body(default={})):
    body = body or {}
    device_id, err = validate_device_id(body.get("device_id"))
    if err:
        return _bad_request(err)

    with get_session() as session:
        a = _get_owned_alert(session, alert_id, device_id)
        if a is None:
            return JSONResponse({"error": "not found"}, status_code=404)

        patch, err = validate_patch_payload(body, current_alert_type=a.alert_type)
        if err:
            return _bad_request(err)

        if "status" in patch:
            status = patch["status"]
            # Resuming clears trigger / broken-link metadata so it can fire again.
            if status == "active" and a.status in {"paused", "triggered", "needs_attention"}:
                a.triggered_message = None
                a.triggered_deal_url = None
                a.check_fail_count = 0
                a.last_check_error = None
            a.status = status

        url_updated = False
        for key, val in patch.items():
            if key == "status" or key not in _UPDATABLE:
                continue
            if key == "product_url" and val and val != a.product_url:
                url_updated = True
            setattr(a, key, val)

        # Fresh URL from the user — clear broken-link state and resume watching.
        if url_updated:
            a.check_fail_count = 0
            a.last_check_error = None
            if a.status == "needs_attention":
                a.status = "active"
                a.triggered_message = None

        session.flush()
        response = _alert_to_dict(a)
        should_recheck = url_updated and a.alert_type == "product" and a.status == "active"
        alert_id = a.id

    if should_recheck:
        _schedule_evaluate(alert_id)
    return response


@router.delete("/{alert_id}")
def delete_sale_alert(alert_id: int, device_id: str = Query(...)):
    device_id, err = validate_device_id(device_id)
    if err:
        return _bad_request(err)

    with get_session() as session:
        a = _get_owned_alert(session, alert_id, device_id)
        if a is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        session.delete(a)
        return {"ok": True}
