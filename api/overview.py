"""Overview endpoints — headline KPIs, top brand/category breakdowns, latest offers."""
from datetime import datetime, timedelta

from flask import Blueprint, jsonify
from sqlalchemy import func

from database.db import get_session
from database.models import Email, Offer

bp = Blueprint("overview", __name__, url_prefix="/api")


def _top_counts(session, column, limit=8):
    rows = (
        session.query(column, func.count(Offer.id))
        .filter(column.isnot(None))
        .group_by(column)
        .order_by(func.count(Offer.id).desc())
        .limit(limit)
        .all()
    )
    return [{"name": name, "count": count} for name, count in rows]


@bp.get("/overview")
def overview():
    with get_session() as session:
        total_offers = session.query(func.count(Offer.id)).scalar() or 0
        verified = session.query(func.count(Offer.id)).filter(
            Offer.verification_status == "verified"
        ).scalar() or 0
        invalid = session.query(func.count(Offer.id)).filter(
            Offer.verification_status == "invalid"
        ).scalar() or 0
        suspicious = session.query(func.count(Offer.id)).filter(
            Offer.verification_status == "suspicious"
        ).scalar() or 0
        unverified = total_offers - verified - invalid - suspicious

        now = datetime.utcnow()
        soon = now + timedelta(days=7)
        expiring_soon = session.query(func.count(Offer.id)).filter(
            Offer.expiry_date.isnot(None),
            Offer.expiry_date >= now,
            Offer.expiry_date <= soon,
        ).scalar() or 0

        top_brands = _top_counts(session, Offer.brand)
        top_categories = _top_counts(session, Offer.category)
        top_subcategories = _top_counts(session, Offer.subcategory)

        latest = (
            session.query(Offer)
            .order_by(Offer.created_at.desc())
            .limit(20)
            .all()
        )
        latest_offers = [
            {
                "id": o.id,
                "brand": o.brand,
                "category": o.category,
                "subcategory": o.subcategory,
                "offer_type": o.offer_type,
                "discount_percentage": o.discount_percentage,
                "coupon_code": o.coupon_code,
                "expiry_date": o.expiry_date.isoformat() if o.expiry_date else None,
                "verification_status": o.verification_status or "unverified",
                "summary": o.summary,
            }
            for o in latest
        ]

    return jsonify({
        "kpis": {
            "total_offers": total_offers,
            "verified": verified,
            "invalid": invalid,
            "expiring_soon": expiring_soon,
        },
        "top_brands": top_brands,
        "top_categories": top_categories,
        "top_subcategories": top_subcategories,
        "verification_status": [
            {"status": "verified", "count": verified},
            {"status": "suspicious", "count": suspicious},
            {"status": "invalid", "count": invalid},
            {"status": "unverified", "count": max(unverified, 0)},
        ],
        "latest_offers": latest_offers,
    })

# "Run fetch & analyse now" (sidebar) now starts the same "email_sync"
# background job as the Email Manager's own trigger — see api/jobs.py's
# generic POST /api/jobs/<job_type>/start. This also fixes the previous bug
# where the sidebar button and Email Manager button could run concurrently.
