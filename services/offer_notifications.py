"""Enqueue personalized FCM alerts when a new Offer row is committed."""
from __future__ import annotations

import threading

from sqlalchemy import event
from sqlalchemy.orm import Session

from config import logger
from database.models import Offer
from services.push import fcm_client

JOB_TYPE = "notify_matching_offer"


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


def schedule_for_new_offer(offer_id: int) -> None:
    if not offer_id:
        return
    if not fcm_client.is_configured():
        logger.info("Skipping offer %s notifications — FCM is not configured", offer_id)
        return

    from services import job_runner, job_service

    payload = {"offer_id": offer_id}
    job = job_service.create_job(JOB_TYPE, payload=payload)
    config = job_runner.get_runner(JOB_TYPE)
    threading.Thread(target=config.run, args=(job["id"], payload), daemon=True).start()


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