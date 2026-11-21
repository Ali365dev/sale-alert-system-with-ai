"""Single-offer AI verification (the dashboard's per-row "Verify" button).
Bulk verification is the verify_offers job (jobs/verify_offers.py)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from core.security import require_admin
from database.db import get_session
from database.models import Offer
from jobs.verify_offers import offer_verification_input

router = APIRouter(prefix="/api/offers", tags=["offer-verify"], dependencies=[Depends(require_admin)])


@router.post("/{offer_id}/verify")
def verify_offer_endpoint(offer_id: int):
    from ai.verifier import verify_offer

    with get_session() as session:
        o = session.query(Offer).filter(Offer.id == offer_id).first()
        if o is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        offer_data = offer_verification_input(o)

    result = verify_offer(offer_data)
    if "error" in result:
        return JSONResponse({"error": result["error"]}, status_code=502)

    with get_session() as session:
        o = session.query(Offer).filter(Offer.id == offer_id).first()
        if o is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        o.verification_status = result["status"]
        o.verification_reason = result["reason"]
        o.verification_confidence = float(result["confidence"])
        o.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)

    return result
