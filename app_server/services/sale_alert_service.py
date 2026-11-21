"""Evaluate, trigger, and notify SaleAlert rows."""
from __future__ import annotations

from datetime import datetime, timezone
from types import SimpleNamespace

from config import logger
from database.db import get_session
from database.models import DeviceToken, SaleAlert
from services.push import fcm_client
from services.sale_alert_analyze import analyze_product_url
from services.sale_alert_brand import enrich_analyze_with_brand
from services.sale_alert_matching import (
    discount_pct,
    product_condition_met,
    product_trigger_message,
)
from services.sale_alert_validation import CHECK_FAIL_THRESHOLD


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _apply_product_snapshot(alert: SaleAlert, snapshot: dict) -> None:
    if snapshot.get("product_name"):
        alert.product_name = snapshot["product_name"]
    if snapshot.get("brand_name"):
        alert.brand_name = snapshot["brand_name"]
    if snapshot.get("image_url"):
        alert.image_url = snapshot["image_url"]
    if snapshot.get("product_url"):
        alert.product_url = snapshot["product_url"]
    if snapshot.get("sku"):
        alert.sku = snapshot["sku"]
    if snapshot.get("current_price") is not None:
        alert.current_price = snapshot["current_price"]
    if snapshot.get("original_price") is not None:
        alert.original_price = snapshot["original_price"]


def _mark_triggered(
    alert: SaleAlert,
    *,
    message: str,
    deal_url: str | None,
) -> None:
    alert.status = "triggered"
    alert.triggered_message = message[:1000]
    alert.triggered_deal_url = (deal_url or "")[:1000] or None
    alert.last_triggered_at = _utcnow()
    alert.last_checked_at = _utcnow()
    alert.check_fail_count = 0
    alert.last_check_error = None
    alert.watch_below_price = None


def _mark_check_failed(alert: SaleAlert, error: str) -> None:
    alert.last_checked_at = _utcnow()
    alert.last_check_error = (error or "check failed")[:1000]
    alert.check_fail_count = int(alert.check_fail_count or 0) + 1
    if alert.status == "active" and alert.check_fail_count >= CHECK_FAIL_THRESHOLD:
        alert.status = "needs_attention"
        alert.triggered_message = (
            "This product link could not be reached. Please update the URL to continue monitoring."
        )[:1000]


def _mark_check_ok(alert: SaleAlert) -> None:
    alert.check_fail_count = 0
    alert.last_check_error = None
    if alert.status == "needs_attention":
        alert.status = "active"
        msg = alert.triggered_message or ""
        if "could not be reached" in msg or msg.startswith("We couldn't open this product link"):
            alert.triggered_message = None


def _push_payload(alert: SaleAlert) -> SimpleNamespace:
    return SimpleNamespace(
        id=alert.id,
        device_id=alert.device_id,
        alert_type=alert.alert_type,
        product_name=alert.product_name,
        brand_name=alert.brand_name,
        notify_push=alert.notify_push,
        notify_in_app=alert.notify_in_app,
        triggered_message=alert.triggered_message,
        triggered_deal_url=alert.triggered_deal_url,
    )


def _send_alert_push(alert: SimpleNamespace | SaleAlert) -> int:
    """Send FCM when push or in-app is enabled (in-app feed is fed by push)."""
    if not (alert.notify_push or alert.notify_in_app):
        return 0
    if not fcm_client.is_configured():
        logger.info("Sale alert %s triggered but FCM is not configured", alert.id)
        return 0

    with get_session() as session:
        tokens = [
            row.token
            for row in session.query(DeviceToken)
            .filter(
                DeviceToken.device_id == alert.device_id,
                DeviceToken.is_active.is_(True),
            )
            .all()
            if row.token
        ]

    if not tokens:
        logger.info("Sale alert %s: no active device tokens for %s", alert.id, alert.device_id)
        return 0

    title = "Sale alert"
    body = alert.triggered_message or "A watched item is on sale"
    if alert.alert_type == "brand" and alert.brand_name:
        title = f"{alert.brand_name} sale alert"
    elif alert.product_name:
        title = alert.product_name

    data = {
        "kind": "price-drop",
        "saleAlertId": str(alert.id),
    }
    if alert.triggered_deal_url:
        data["url"] = alert.triggered_deal_url

    try:
        response = fcm_client.send_multicast(tokens, title, body[:180], data)
        return int(getattr(response, "success_count", 0) or 0)
    except Exception:
        logger.exception("Failed to push sale alert %s", alert.id)
        return 0


def check_product_alert(alert_id: int, *, notify: bool = True) -> dict:
    """Re-fetch product URL, update prices, trigger if condition matches."""
    with get_session() as session:
        alert = session.query(SaleAlert).filter(SaleAlert.id == alert_id).first()
        if alert is None:
            return {"ok": False, "error": "not found"}
        if alert.alert_type != "product":
            return {"ok": False, "error": "not a product alert"}
        if alert.status == "paused":
            return {"ok": True, "status": "paused", "triggered": False}
        if not (alert.product_url or "").strip():
            _mark_check_failed(alert, "missing product_url")
            return {"ok": False, "error": "missing product_url", "status": alert.status}

        url = alert.product_url
        alert_id_val = alert.id
        can_trigger = alert.status in {"active", "needs_attention"}

    snapshot = analyze_product_url(url)
    # Logo fallback only on recheck — do not spam BrandRequest from the scheduler.
    if snapshot.get("ok"):
        snapshot = enrich_analyze_with_brand(snapshot, record_missing=False)
    push_payload = None
    with get_session() as session:
        alert = session.query(SaleAlert).filter(SaleAlert.id == alert_id_val).first()
        if alert is None:
            return {"ok": False, "error": "not found"}

        if not snapshot.get("ok"):
            _mark_check_failed(alert, snapshot.get("error") or "analyze failed")
            return {
                "ok": False,
                "error": snapshot.get("error") or "analyze failed",
                "triggered": False,
                "status": alert.status,
                "check_fail_count": alert.check_fail_count,
            }

        _mark_check_ok(alert)
        alert.last_checked_at = _utcnow()
        _apply_product_snapshot(alert, snapshot)
        current = snapshot.get("current_price")
        original = snapshot.get("original_price")
        met = product_condition_met(
            alert.condition_type,
            current_price=current,
            original_price=original,
            custom_pct=alert.custom_pct,
            target_price=alert.target_price,
            watch_below_price=alert.watch_below_price,
        )

        triggered_now = False
        if met and (can_trigger or alert.status == "active"):
            message = product_trigger_message(
                alert.product_name,
                current_price=current,
                original_price=original,
            )
            _mark_triggered(alert, message=message, deal_url=alert.product_url)
            triggered_now = True
            if notify:
                push_payload = _push_payload(alert)
        elif met and alert.status == "triggered":
            alert.triggered_message = product_trigger_message(
                alert.product_name,
                current_price=current,
                original_price=original,
            )[:1000]

        result = {
            "ok": True,
            "triggered": triggered_now,
            "status": alert.status,
            "current_price": alert.current_price,
            "original_price": alert.original_price,
            "discount_pct": discount_pct(alert.current_price, alert.original_price),
            "message": alert.triggered_message,
            "check_fail_count": alert.check_fail_count,
        }

    if push_payload is not None:
        result["push_sent"] = _send_alert_push(push_payload)

    return result
