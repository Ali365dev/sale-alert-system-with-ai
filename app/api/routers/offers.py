"""Offers manager endpoints — list/filter, CRUD, and AI verification. Ported
from api/offers.py — logic and response shape unchanged. Error responses use
JSONResponse({"error": ...}) rather than HTTPException, since the dashboard's
apiClient interceptor (dashboard/src/api/client.ts) reads response.data.error
specifically — FastAPI's default HTTPException shape is {"detail": ...},
which would silently break that toast."""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse
from sqlalchemy import case, func

from database.db import get_session
from database.models import Offer
from database.offer_retention import compute_offer_status

router = APIRouter(prefix="/api/offers", tags=["offers"])


def _offer_to_dict(o: Offer) -> dict:
    return {
        "id": o.id,
        "email_id": o.email_id,
        "title": o.title,
        "brand": o.brand,
        "company": o.company,
        "category": o.category,
        "subcategory": o.subcategory,
        "offer_type": o.offer_type,
        "discount_percentage": o.discount_percentage,
        "coupon_code": o.coupon_code,
        "expiry_date": o.expiry_date.isoformat() if o.expiry_date else None,
        "expiry_date_basis": o.expiry_date_basis,
        "expiry_date_confidence": o.expiry_date_confidence,
        "status": compute_offer_status(o.expiry_date),
        "delete_after": o.delete_after.isoformat() if o.delete_after else None,
        "offer_value": o.offer_value,
        "website": o.website,
        "summary": o.summary,
        "key_highlights": json.loads(o.key_highlights) if o.key_highlights else [],
        "is_active": o.is_active,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "verification_status": o.verification_status,
        "verification_reason": o.verification_reason,
        "verification_confidence": o.verification_confidence,
        "verified_at": o.verified_at.isoformat() if o.verified_at else None,
        "source": o.source,
        "source_url": o.source_url,
        "closure_status": o.closure_status,
    }


def _parse_expiry(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


@router.get("")
def list_offers(
    brand: str | None = Query(None),
    email_id: int | None = Query(None),
    category: str | None = Query(None),
    subcategory: str | None = Query(None),
    offer_type: str | None = Query(None),
    verification_status: str | None = Query(None),
    active: str | None = Query(None),
):
    with get_session() as session:
        q = session.query(Offer)
        if brand:
            q = q.filter(Offer.brand == brand)
        if email_id is not None:
            q = q.filter(Offer.email_id == email_id)
        if category:
            q = q.filter(Offer.category == category)
        if subcategory:
            q = q.filter(Offer.subcategory == subcategory)
        if offer_type:
            q = q.filter(Offer.offer_type == offer_type)
        if verification_status == "unverified":
            q = q.filter(Offer.verification_status.is_(None))
        elif verification_status:
            q = q.filter(Offer.verification_status == verification_status)
        if active == "true":
            q = q.filter(Offer.is_active.is_(True))
        elif active == "false":
            q = q.filter(Offer.is_active.is_(False))

        offers = q.order_by(Offer.id.desc()).all()

        total, verified, suspicious, invalid, active_count = session.query(
            func.count(Offer.id),
            func.count(case((Offer.verification_status == "verified", 1))),
            func.count(case((Offer.verification_status == "suspicious", 1))),
            func.count(case((Offer.verification_status == "invalid", 1))),
            func.count(case((Offer.is_active.is_(True), 1))),
        ).one()
        unverified = max(total - verified - suspicious - invalid, 0)

        offer_dicts = [_offer_to_dict(o) for o in offers]

    return {
        "offers": offer_dicts,
        "summary": {
            "total": total,
            "verified": verified,
            "suspicious": suspicious,
            "invalid": invalid,
            "unverified": unverified,
            "active": active_count,
        },
    }


@router.get("/{offer_id}")
def get_offer(offer_id: int):
    with get_session() as session:
        o = session.query(Offer).filter(Offer.id == offer_id).first()
        if o is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        return _offer_to_dict(o)


@router.post("")
def create_offer(body: dict = Body(...)):
    with get_session() as session:
        offer = Offer(
            email_id=body.get("email_id"),
            brand=body.get("brand") or None,
            company=body.get("company") or None,
            category=body.get("category") or None,
            subcategory=body.get("subcategory") or None,
            offer_type=body.get("offer_type") or None,
            discount_percentage=body.get("discount_percentage"),
            coupon_code=body.get("coupon_code") or None,
            expiry_date=_parse_expiry(body.get("expiry_date")),
            offer_value=body.get("offer_value") or None,
            website=body.get("website") or None,
            summary=body.get("summary") or None,
            key_highlights=json.dumps(body.get("key_highlights", [])),
            is_active=bool(body.get("is_active", True)),
            source="manual",
        )
        session.add(offer)
        session.flush()
        return JSONResponse(_offer_to_dict(offer), status_code=201)


@router.put("/{offer_id}")
def update_offer(offer_id: int, body: dict = Body(...)):
    with get_session() as session:
        o = session.query(Offer).filter(Offer.id == offer_id).first()
        if o is None:
            return JSONResponse({"error": "not found"}, status_code=404)

        for field in ("brand", "company", "category", "subcategory", "offer_type",
                      "discount_percentage", "coupon_code", "offer_value", "website", "summary"):
            if field in body:
                setattr(o, field, body[field] or None)
        if "expiry_date" in body:
            o.expiry_date = _parse_expiry(body["expiry_date"])
        if "key_highlights" in body:
            o.key_highlights = json.dumps(body["key_highlights"])
        if "is_active" in body:
            o.is_active = bool(body["is_active"])
        if "verification_status" in body:
            status = body["verification_status"] or None
            if status not in (None, "verified", "suspicious", "invalid"):
                return JSONResponse({"error": "invalid verification_status"}, status_code=400)
            o.verification_status = status
            o.verification_reason = "Manually set" if status else None
            o.verification_confidence = 100.0 if status else None
            o.verified_at = datetime.now(timezone.utc).replace(tzinfo=None) if status else None

        session.flush()
        return _offer_to_dict(o)


@router.delete("/{offer_id}")
def delete_offer(offer_id: int):
    with get_session() as session:
        o = session.query(Offer).filter(Offer.id == offer_id).first()
        if o is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        session.delete(o)
    return {"status": "deleted"}


@router.post("/{offer_id}/verify")
def verify_offer_endpoint(offer_id: int):
    from ai.verifier import verify_offer

    with get_session() as session:
        o = session.query(Offer).filter(Offer.id == offer_id).first()
        if o is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        offer_data = _offer_to_dict(o)

    result = verify_offer(offer_data)
    if "error" in result:
        return JSONResponse({"error": result["error"]}, status_code=502)

    with get_session() as session:
        o = session.query(Offer).filter(Offer.id == offer_id).first()
        o.verification_status = result["status"]
        o.verification_reason = result["reason"]
        o.verification_confidence = float(result["confidence"])
        o.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)

    return result


# Bulk "verify all unverified offers" is now the "verify_offers" background job —
# see services/jobs/verify_offers.py, started via POST /api/jobs/verify_offers/start.
