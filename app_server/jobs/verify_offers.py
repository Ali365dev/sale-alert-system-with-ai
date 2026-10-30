"""Verify every unverified offer via the AI verifier, one at a time.

Template case for the sequential BackgroundJob framework — ported straight
from api/offers.py's old _run_verify_all.
"""
from datetime import datetime, timezone

from database.db import get_session
from database.models import Offer
from services.jobs.base import BackgroundJob, WorkItem


def _offer_to_dict(o: Offer) -> dict:
    return {
        "id": o.id,
        "brand": o.brand,
        "company": o.company,
        "category": o.category,
        "subcategory": o.subcategory,
        "offer_type": o.offer_type,
        "discount_percentage": o.discount_percentage,
        "coupon_code": o.coupon_code,
        "expiry_date": o.expiry_date.isoformat() if o.expiry_date else None,
        "offer_value": o.offer_value,
        "summary": o.summary,
        "website": o.website,
    }


_VALID_STATUSES = {"verified", "suspicious", "invalid"}


class VerifyOffersJob(BackgroundJob):
    job_type = "verify_offers"

    def collect_work(self, job: dict) -> list[WorkItem]:
        # payload.statuses lets the caller re-verify already-classified offers
        # (e.g. "suspicious"/"invalid") instead of only unverified ones — no
        # payload (or an empty/invalid list) preserves the original
        # unverified-only behavior.
        statuses = [s for s in (job.get("payload") or {}).get("statuses") or [] if s in _VALID_STATUSES]

        with get_session() as session:
            query = session.query(Offer)
            query = query.filter(Offer.verification_status.in_(statuses)) if statuses else query.filter(Offer.verification_status.is_(None))
            offers = query.order_by(Offer.id.asc()).all()
            return [WorkItem(id=o.id, label=f"{o.brand or 'Unknown brand'} — offer #{o.id}") for o in offers]

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from ai.verifier import verify_offer
        from services import job_service

        job_service.set_stage(job_id, "verifying_offer")

        with get_session() as session:
            o = session.query(Offer).filter(Offer.id == item.id).first()
            if o is None:
                return "skipped"
            offer_data = _offer_to_dict(o)

        result = verify_offer(offer_data)
        if "error" in result:
            job_service.append_log(
                job_id, f"⚠ Could not verify \"{item.label}\" — {result['error']}", severity="warning", category="ai",
            )
            return "failed"

        with get_session() as session:
            o = session.query(Offer).filter(Offer.id == item.id).first()
            if o:
                o.verification_status = result["status"]
                o.verification_reason = result["reason"]
                o.verification_confidence = float(result["confidence"])
                o.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)

        job_service.append_log(job_id, f"✓ Verified \"{item.label}\" — {result['status']}", severity="success", category="ai")
        return "successful"
