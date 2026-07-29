"""Search endpoint — filterable offers joined with their source email, plus CSV export."""
import csv
import io
from datetime import datetime

from flask import Blueprint, Response, jsonify, request

from database.db import get_session
from database.models import Email, Offer

bp = Blueprint("search", __name__, url_prefix="/api/search")


def _apply_filters(session, args):
    q = session.query(Offer, Email.subject, Email.sender, Email.received_date).outerjoin(
        Email, Offer.email_id == Email.id
    )

    brand = args.get("brand")
    if brand:
        q = q.filter(Offer.brand.ilike(f"%{brand}%"))

    subject = args.get("subject")
    if subject:
        q = q.filter(Email.subject.ilike(f"%{subject}%"))

    category = args.get("category")
    if category:
        q = q.filter(Offer.category == category)

    subcategory = args.get("subcategory")
    if subcategory:
        q = q.filter(Offer.subcategory == subcategory)

    offer_type = args.get("offer_type")
    if offer_type:
        q = q.filter(Offer.offer_type == offer_type)

    verification_status = args.get("verification_status")
    if verification_status == "unverified":
        q = q.filter(Offer.verification_status.is_(None))
    elif verification_status:
        q = q.filter(Offer.verification_status == verification_status)

    min_discount = args.get("min_discount", type=float)
    if min_discount:
        q = q.filter(Offer.discount_percentage >= min_discount)

    date_from = args.get("date_from")
    if date_from:
        q = q.filter(Email.received_date >= datetime.fromisoformat(date_from))

    date_to = args.get("date_to")
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


@bp.get("")
def search():
    with get_session() as session:
        rows = _apply_filters(session, request.args).all()
        results = [_row_dict(o, subject, sender, received_date) for o, subject, sender, received_date in rows]

    return jsonify({"count": len(results), "results": results})


@bp.get("/export.csv")
def export_csv():
    with get_session() as session:
        rows = _apply_filters(session, request.args).all()
        results = [_row_dict(o, subject, sender, received_date) for o, subject, sender, received_date in rows]

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
        buf.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
