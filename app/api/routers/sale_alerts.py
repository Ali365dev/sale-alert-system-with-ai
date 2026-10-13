"""Per-device product/brand sale watchlist — public, keyed by device_id."""
from __future__ import annotations

import threading

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse

from database.db import get_session
from database.models import SaleAlert
from services.sale_alert_analyze import analyze_product_url
from services.sale_alert_service import check_product_alert, evaluate_alert_on_create

router = APIRouter(prefix="/api/sale-alerts", tags=["sale-alerts"])

_ALERT_TYPES = frozenset({"product", "brand"})
_STATUSES = frozenset({"active", "paused", "triggered"})
_CONDITION_TYPES = frozenset({
    "any_sale", "pct_10", "pct_20", "pct_30", "custom_pct", "target_price", "new_promotion", "new_code",
})

_UPDATABLE = frozenset({
    "alert_type", "status", "product_name", "brand_name", "product_url", "image_url",
    "current_price", "original_price", "sku", "variant", "condition_type", "custom_pct", "target_price",
    "notify_push", "notify_email", "notify_in_app",
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
        "notify_push": a.notify_push,
        "notify_email": a.notify_email,
        "notify_in_app": a.notify_in_app,
        "last_checked_at": a.last_checked_at.isoformat() if a.last_checked_at else None,
        "last_triggered_at": a.last_triggered_at.isoformat() if a.last_triggered_at else None,
        "triggered_message": a.triggered_message,
        "triggered_deal_url": a.triggered_deal_url,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "updated_at": a.updated_at.isoformat() if a.updated_at else None,
    }


def _require_device_id(device_id: str | None) -> str | JSONResponse:
    device_id = (device_id or "").strip()
    if not device_id:
        return JSONResponse({"error": "device_id is required"}, status_code=400)
    return device_id


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
    device_id = _require_device_id(device_id)
    if isinstance(device_id, JSONResponse):
        return device_id

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
    body = body or {}
    device_id = _require_device_id(body.get("device_id"))
    if isinstance(device_id, JSONResponse):
        return device_id

    alert_type = (body.get("alert_type") or "product").strip()
    if alert_type not in _ALERT_TYPES:
        return JSONResponse({"error": "alert_type must be 'product' or 'brand'"}, status_code=400)

    condition_type = (body.get("condition_type") or "any_sale").strip()
    if condition_type not in _CONDITION_TYPES:
        return JSONResponse({"error": "invalid condition_type"}, status_code=400)

    status = (body.get("status") or "active").strip()
    if status not in _STATUSES:
        return JSONResponse({"error": "status must be 'active', 'paused', or 'triggered'"}, status_code=400)

    if alert_type == "product" and not (body.get("product_name") or body.get("product_url") or body.get("brand_name")):
        return JSONResponse({"error": "product alerts need a product name, URL, or brand"}, status_code=400)
    if alert_type == "brand" and not (body.get("brand_name") or "").strip():
        return JSONResponse({"error": "brand_name is required for brand alerts"}, status_code=400)

    with get_session() as session:
        a = SaleAlert(
            device_id=device_id,
            alert_type=alert_type,
            status=status,
            product_name=(body.get("product_name") or "").strip() or None,
            brand_name=(body.get("brand_name") or "").strip() or None,
            product_url=(body.get("product_url") or "").strip() or None,
            image_url=(body.get("image_url") or "").strip() or None,
            current_price=body.get("current_price"),
            original_price=body.get("original_price"),
            sku=(body.get("sku") or "").strip() or None,
            variant=(body.get("variant") or "").strip() or None,
            condition_type=condition_type,
            custom_pct=body.get("custom_pct"),
            target_price=body.get("target_price"),
            notify_push=body.get("notify_push") if "notify_push" in body else True,
            notify_email=body.get("notify_email") if "notify_email" in body else False,
            notify_in_app=body.get("notify_in_app") if "notify_in_app" in body else True,
        )
        session.add(a)
        session.flush()
        payload = _alert_to_dict(a)
        alert_id = a.id

    if status == "active":
        _schedule_evaluate(alert_id)
    return JSONResponse(payload, status_code=201)


@router.post("/analyze-product")
def analyze_product(body: dict = Body(default={})):
    body = body or {}
    return analyze_product_url(body.get("url"))


@router.post("/{alert_id}/check")
def check_sale_alert(alert_id: int, body: dict = Body(default={})):
    """Manually recheck a product alert (also useful for QA)."""
    body = body or {}
    device_id = _require_device_id(body.get("device_id"))
    if isinstance(device_id, JSONResponse):
        return device_id

    with get_session() as session:
        a = _get_owned_alert(session, alert_id, device_id)
        if a is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        if a.alert_type != "product":
            return JSONResponse({"error": "only product alerts can be rechecked"}, status_code=400)

    result = check_product_alert(alert_id, notify=True)
    with get_session() as session:
        a = _get_owned_alert(session, alert_id, device_id)
        alert_dict = _alert_to_dict(a) if a else None
    return {"result": result, "alert": alert_dict}


@router.get("/{alert_id}")
def get_sale_alert(alert_id: int, device_id: str = Query(...)):
    device_id = _require_device_id(device_id)
    if isinstance(device_id, JSONResponse):
        return device_id

    with get_session() as session:
        a = _get_owned_alert(session, alert_id, device_id)
        if a is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        return _alert_to_dict(a)


@router.patch("/{alert_id}")
def update_sale_alert(alert_id: int, body: dict = Body(default={})):
    body = body or {}
    device_id = _require_device_id(body.get("device_id"))
    if isinstance(device_id, JSONResponse):
        return device_id

    with get_session() as session:
        a = _get_owned_alert(session, alert_id, device_id)
        if a is None:
            return JSONResponse({"error": "not found"}, status_code=404)

        if "status" in body:
            status = (body.get("status") or "").strip()
            if status not in _STATUSES:
                return JSONResponse({"error": "status must be 'active', 'paused', or 'triggered'"}, status_code=400)
            # Resuming a triggered alert clears trigger metadata so it can fire again.
            if status == "active" and a.status in {"paused", "triggered"}:
                a.triggered_message = None
                a.triggered_deal_url = None
            a.status = status

        if "alert_type" in body:
            alert_type = (body.get("alert_type") or "").strip()
            if alert_type not in _ALERT_TYPES:
                return JSONResponse({"error": "alert_type must be 'product' or 'brand'"}, status_code=400)
            a.alert_type = alert_type

        if "condition_type" in body:
            condition_type = (body.get("condition_type") or "").strip()
            if condition_type not in _CONDITION_TYPES:
                return JSONResponse({"error": "invalid condition_type"}, status_code=400)
            a.condition_type = condition_type

        for key in _UPDATABLE - {"alert_type", "status", "condition_type"}:
            if key not in body:
                continue
            val = body[key]
            if key in ("product_name", "brand_name", "product_url", "image_url", "sku", "variant") and val is not None:
                val = str(val).strip() or None
            setattr(a, key, val)

        session.flush()
        return _alert_to_dict(a)


@router.delete("/{alert_id}")
def delete_sale_alert(alert_id: int, device_id: str = Query(...)):
    device_id = _require_device_id(device_id)
    if isinstance(device_id, JSONResponse):
        return device_id

    with get_session() as session:
        a = _get_owned_alert(session, alert_id, device_id)
        if a is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        session.delete(a)
        return {"ok": True}
