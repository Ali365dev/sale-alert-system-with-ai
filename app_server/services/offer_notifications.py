"""When a new Offer is committed here (POST /offers, routers/brands.py), ask
scraper_server to run notify_matching_offer for it — that job does the brand
sale-alert matching and the preference-based FCM fan-out."""
from __future__ import annotations

from sqlalchemy import event
from sqlalchemy.orm import Session

from config import logger
from database.models import Offer
from services.scraper_jobs import trigger_job

JOB_TYPE = "notify_matching_offer"

_HOOKS_REGISTERED = False


def register_hooks() -> None:
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
                trigger_job(JOB_TYPE, {"offer_id": offer_id})
            except Exception:
                logger.exception("Failed to schedule notifications for offer %s", offer_id)

    @event.listens_for(Session, "after_rollback")
    def _clear_new_offers(session) -> None:
        session.info.pop("new_offer_ids", None)
