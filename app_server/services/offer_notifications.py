"""Enqueue personalized FCM alerts when a new Offer row is committed.

app_server runs no background jobs of its own (see
.claude/rules/server-routing.md) — the actual preference-matching + FCM
fan-out (job type notify_matching_offer) only runs on scraper_server. This
module still owns the SQLAlchemy hook, since an Offer can be created here
directly (POST /offers, routers/brands.py), and just hands the job off to
scraper_server over HTTP instead of running it in-process."""
from __future__ import annotations

import os
import threading
import urllib.error
import urllib.request

from sqlalchemy import event
from sqlalchemy.orm import Session

from config import logger
from database.models import Offer
from services.push import fcm_client
from services.settings_service import get_setting

JOB_TYPE = "notify_matching_offer"
_TRIGGER_TIMEOUT = 15


def notification_copy(offer: Offer) -> tuple[str, str, dict]:
    brand = (offer.brand or "Deal Plus").strip() or "Deal Plus"
    discount = offer.discount_percentage
    if offer.summary:
        body = offer.summary.strip()[:180]
    elif discount is not None:
        cats = " / ".join(p for p in (offer.category, offer.subcategory) if p)
        body = f"Up to {int(round(discount))}% off {brand}" + (f" {cats.lower()}." if cats else ".")
    else:
        body = offer.title or f"New {brand} offer. Tap to view."
    title = f"{brand} sale alert"
    data = {
        "dealId": str(offer.id),
        "offerId": str(offer.id),
        "kind": "flash-sale" if (discount or 0) >= 30 else "new-brand",
    }
    return title, body, data


def _match_sale_alerts(offer_id: int) -> None:
    try:
        from services.sale_alert_service import match_brand_alerts_for_offer

        result = match_brand_alerts_for_offer(offer_id, notify=True)
        if result.get("matched"):
            logger.info(
                "Offer %s matched %s brand sale alert(s)",
                offer_id,
                result.get("matched"),
            )
    except Exception:
        logger.exception("Failed matching brand sale alerts for offer %s", offer_id)


def _trigger_notify_job(offer_id: int) -> None:
    """Fire-and-forget POST to scraper_server's /api/jobs/notify_matching_offer/start
    — the job itself (preference matching + FCM fan-out) only runs there."""
    base_url = os.getenv("SCRAPER_SERVER_URL", "").rstrip("/")
    if not base_url:
        logger.warning("Skipping offer %s notifications — SCRAPER_SERVER_URL is not set", offer_id)
        return

    secret = get_setting("internal_service_secret", default="")
    req = urllib.request.Request(
        f"{base_url}/api/jobs/{JOB_TYPE}/start",
        data=b"{}",
        method="POST",
        headers={"Content-Type": "application/json", "X-Internal-Secret": secret},
    )
    try:
        with urllib.request.urlopen(req, timeout=_TRIGGER_TIMEOUT) as resp:
            logger.info("Triggered %s on scraper_server for offer %s (%s)", JOB_TYPE, offer_id, resp.status)
    except urllib.error.HTTPError as exc:
        # already_running (409) is expected when the hook and a bulk import
        # both land in the same window — scraper_server's own collect_work
        # already covers this offer either way.
        if exc.code != 409:
            logger.warning("Failed to trigger %s for offer %s: HTTP %s", JOB_TYPE, offer_id, exc.code)
    except Exception as exc:
        logger.warning("Failed to trigger %s for offer %s: %s", JOB_TYPE, offer_id, exc)


def schedule_for_new_offer(offer_id: int) -> None:
    if not offer_id:
        return

    # Brand SaleAlert watchlist — independent of preference-based FCM fan-out.
    threading.Thread(target=_match_sale_alerts, args=(offer_id,), daemon=True).start()

    if not fcm_client.is_configured():
        logger.info("Skipping offer %s preference notifications — FCM is not configured", offer_id)
        return

    threading.Thread(target=_trigger_notify_job, args=(offer_id,), daemon=True).start()


_HOOKS_REGISTERED = False


def register_hooks() -> None:
    """After a new Offer is committed, fan out matching-user notifications."""
    global _HOOKS_REGISTERED
    if _HOOKS_REGISTERED:
        return
    _HOOKS_REGISTERED = True

    @event.listens_for(Session, "after_flush")
    def _collect_new_offers(session, _flush_context) -> None:
        ids = session.info.setdefault("new_offer_ids", [])
        for obj in session.new:
            if isinstance(obj, Offer) and obj.id and obj.is_active:
                ids.append(obj.id)

    @event.listens_for(Session, "after_commit")
    def _dispatch_new_offers(session) -> None:
        ids = list(dict.fromkeys(session.info.pop("new_offer_ids", [])))
        for offer_id in ids:
            try:
                schedule_for_new_offer(offer_id)
            except Exception:
                logger.exception("Failed to schedule notifications for offer %s", offer_id)

    @event.listens_for(Session, "after_rollback")
    def _clear_new_offers(session) -> None:
        session.info.pop("new_offer_ids", None)