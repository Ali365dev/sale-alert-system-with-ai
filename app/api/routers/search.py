"""Search endpoint — filterable offers joined with their source email, plus
CSV export. Ported from api/search.py — logic and response shape unchanged;
Flask's request.args.get(...) becomes explicit FastAPI Query params, and the
Flask Response(mimetype=...) CSV export becomes fastapi.responses.Response
with the same Content-Disposition header."""
import csv
import io
from datetime import datetime

from fastapi import APIRouter, Query
from fastapi.responses import Response

from database.db import get_session
from database.models import Email, Offer

router = APIRouter(prefix="/api/search", tags=["search"])


def _apply_filters(
    session,
    brand: str | None,
    subject: str | None,
    category: str | None,
    subcategory: str | None,
    offer_type: str | None,
    verification_status: str | None,
    min_discount: float | None,
    date_from: str | None,
    date_to: str | None,
):
    q = session.query(Offer, Email.subject, Email.sender, Email.received_date).outerjoin(
        Email, Offer.email_id == Email.id
    )

    if brand:
        q = q.filter(Offer.brand.ilike(f"%{brand}%"))

    if subject:
        q = q.filter(Email.subject.ilike(f"%{subject}%"))

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

    if min_discount:
        q = q.filter(Offer.discount_percentage >= min_discount)

    if date_from:
        q = q.filter(Email.received_date >= datetime.fromisoformat(date_from))

    if date_to:
        q = q.filter(Email.received_date <= datetime.fromisoformat(date_to))

    return q.order_by(Offer.created_at.desc())


def _row_dict(offer: Offer, subject, sender, received_date) -> dict:
    return {
        "id": offer.id,
        "brand": offer.brand,
        "category": offer.category,
        "subcategory": offer.subcategory,
        "offer_type": offer.offer_type,
        "discount_percentage": offer.discount_percentage,
        "coupon_code": offer.coupon_code,
        "expiry_date": offer.expiry_date.isoformat() if offer.expiry_date else None,
        "verification_status": offer.verification_status or "unverified",
        "summary": offer.summary,
        "subject": subject,
        "sender": sender,
        "received_date": received_date.isoformat() if received_date else None,
    }


@router.get("")
def search(
    brand: str | None = Query(None),
    subject: str | None = Query(None),
    category: str | None = Query(None),
    subcategory: str | None = Query(None),
    offer_type: str | None = Query(None),
    verification_status: str | None = Query(None),
    min_discount: float | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    with get_session() as session:
        rows = _apply_filters(
            session, brand, subject, category, subcategory, offer_type,
            verification_status, min_discount, date_from, date_to,
        ).all()
        results = [_row_dict(o, subject_, sender, received_date) for o, subject_, sender, received_date in rows]

    return {"count": len(results), "results": results}


@router.get("/export.csv")
def export_csv(
    brand: str | None = Query(None),
    subject: str | None = Query(None),
    category: str | None = Query(None),
    subcategory: str | None = Query(None),
    offer_type: str | None = Query(None),
    verification_status: str | None = Query(None),
    min_discount: float | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
):
    with get_session() as session:
        rows = _apply_filters(
            session, brand, subject, category, subcategory, offer_type,
            verification_status, min_discount, date_from, date_to,
        ).all()
        results = [_row_dict(o, subject_, sender, received_date) for o, subject_, sender, received_date in rows]

    buf = io.StringIO()
    fieldnames = [
        "id", "brand", "category", "subcategory", "offer_type", "discount_percentage",
        "coupon_code", "expiry_date", "verification_status", "summary", "subject", "sender", "received_date",
    ]
    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(results)

    filename = f"offers_export_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
