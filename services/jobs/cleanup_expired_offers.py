"""Manual, operator-visible run of the retention cleanup — deletes every
offer whose delete_after has passed, one at a time so it gets the same
progress bar / history / retry treatment as every other pipeline action.

This is the "Run Now" counterpart to the automatic daily run in
services/scheduler.py — same underlying query (services.cleanup), same rule
(delete_after <= now, nothing else), same guarantee that only Offer rows are
touched, never the source Email/Gmail record.
"""
from database.db import get_session
from database.models import Offer
from services.cleanup import find_expired_offer_ids
from services.jobs.base import BackgroundJob, WorkItem


class CleanupExpiredOffersJob(BackgroundJob):
    job_type = "cleanup_expired_offers"

    def collect_work(self, job: dict) -> list[WorkItem]:
        with get_session() as session:
            offers = (
                session.query(Offer)
                .filter(Offer.id.in_(find_expired_offer_ids()))
                .order_by(Offer.id.asc())
                .all()
            )
            return [
                WorkItem(id=o.id, label=f"{o.brand or 'Unknown brand'} — offer #{o.id} (past {o.delete_after})")
                for o in offers
            ]

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from services import job_service

        with get_session() as session:
            o = session.query(Offer).filter(Offer.id == item.id).first()
            if o is None:
                return "skipped"
            session.delete(o)

        job_service.append_log(job_id, f"🗑 Deleted \"{item.label}\"", severity="success", category="offer")
        return "successful"
