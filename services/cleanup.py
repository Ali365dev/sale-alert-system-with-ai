"""Retention cleanup — deletes Offer rows whose delete_after has passed.

Deliberately only touches the offers table. The source Gmail message and its
Email/OCR record are never deleted here — Gmail remains the permanent record;
the app's database is only temporary storage for processed offers.

Two entry points share find_expired_offer_ids():
  - cleanup_expired_offers() below — the daily APScheduler job
    (services/scheduler.py), bulk delete, no UI/progress needed.
  - services.jobs.cleanup_expired_offers.CleanupExpiredOffersJob — the
    Pipeline Center "Run Now" button, one offer at a time so it gets the
    same progress/history tracking as every other pipeline action.

Offers with delete_after = null are never touched by either — every offer
gets delete_after computed at creation (ai.analyzer.build_offer) or by the
one-time migration backfill (database.db._backfill_delete_after), so a null
value means "not ready to be evaluated yet", not "safe to delete".
"""
from config import logger
from database.db import get_session
from database.models import Offer
from database.offer_retention import utcnow


def find_expired_offer_ids() -> list[int]:
    now = utcnow()
    with get_session() as session:
        rows = (
            session.query(Offer.id)
            .filter(Offer.delete_after.isnot(None), Offer.delete_after <= now)
            .order_by(Offer.id.asc())
            .all()
        )
        return [r[0] for r in rows]


def cleanup_expired_offers() -> int:
    """Delete every offer whose delete_after <= now. Returns the count deleted."""
    now = utcnow()
    with get_session() as session:
        to_delete = (
            session.query(Offer)
            .filter(Offer.delete_after.isnot(None), Offer.delete_after <= now)
            .all()
        )
        count = len(to_delete)
        for offer in to_delete:
            session.delete(offer)

    if count:
        logger.info("Cleanup: deleted %d expired offer(s)", count)
    else:
        logger.info("Cleanup: no offers past their retention window")
    return count
