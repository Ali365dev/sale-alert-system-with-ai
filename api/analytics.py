"""Analytics endpoints — distributions, breakdowns, and trends over offers."""
from collections import defaultdict

from flask import Blueprint, jsonify
from sqlalchemy import func

from database.db import get_session
from database.models import Email, Offer

bp = Blueprint("analytics", __name__, url_prefix="/api")


def _counts(session, column, limit=None):
    q = (
        session.query(column, func.count(Offer.id))
        .filter(column.isnot(None))
        .group_by(column)
        .order_by(func.count(Offer.id).desc())
    )
    if limit:
        q = q.limit(limit)
    return [{"name": name, "count": count} for name, count in q.all()]


def _discount_histogram(discounts: list[float], bins: int = 10) -> list[dict]:
    if not discounts:
        return []
    lo, hi = 0, 100
    width = (hi - lo) / bins
    buckets = [0] * bins
    for d in discounts:
        idx = min(int((d - lo) / width), bins - 1)
        buckets[max(idx, 0)] += 1
    return [
        {"range": f"{int(lo + i * width)}-{int(lo + (i + 1) * width)}%", "count": buckets[i]}
        for i in range(bins)
    ]


@bp.get("/analytics")
def analytics():
    with get_session() as session:
        offers_by_brand = _counts(session, Offer.brand, limit=12)
        offers_by_category = _counts(session, Offer.category)
        top_subcategories = _counts(session, Offer.subcategory, limit=12)
        offer_types = _counts(session, Offer.offer_type)

        discounts = [
            d for (d,) in session.query(Offer.discount_percentage).filter(Offer.discount_percentage.isnot(None)).all()
        ]
        discount_histogram = _discount_histogram(discounts)

        verified = session.query(func.count(Offer.id)).filter(Offer.verification_status == "verified").scalar() or 0
        suspicious = session.query(func.count(Offer.id)).filter(Offer.verification_status == "suspicious").scalar() or 0
        invalid = session.query(func.count(Offer.id)).filter(Offer.verification_status == "invalid").scalar() or 0
        total = session.query(func.count(Offer.id)).scalar() or 0
        unverified = max(total - verified - suspicious - invalid, 0)
        verification_status = [
            {"status": "verified", "count": verified},
            {"status": "suspicious", "count": suspicious},
            {"status": "invalid", "count": invalid},
            {"status": "unverified", "count": unverified},
        ]

        monthly = defaultdict(int)
        for (received_date,) in session.query(Email.received_date).filter(Email.received_date.isnot(None)).all():
            monthly[received_date.strftime("%Y-%m")] += 1
        monthly_trend = [{"month": k, "count": v} for k, v in sorted(monthly.items())]

        brand_rows = (
            session.query(Offer.brand, func.count(Offer.id), func.avg(Offer.discount_percentage))
            .filter(Offer.brand.isnot(None))
            .group_by(Offer.brand)
            .all()
        )
        verified_per_brand = defaultdict(int)
        for (brand, status) in session.query(Offer.brand, Offer.verification_status).filter(Offer.brand.isnot(None)).all():
            if status == "verified":
                verified_per_brand[brand] += 1

        brand_performance = sorted(
            [
                {
                    "brand": brand,
                    "offers": count,
                    "avg_discount": round(avg_disc, 1) if avg_disc is not None else None,
                    "verified": verified_per_brand.get(brand, 0),
                }
                for brand, count, avg_disc in brand_rows
            ],
            key=lambda r: r["offers"],
            reverse=True,
        )[:15]

        top_discounted_brands = sorted(
            [b for b in brand_performance if b["avg_discount"] is not None],
            key=lambda b: b["avg_discount"],
            reverse=True,
        )[:10]

    return jsonify({
        "offers_by_brand": offers_by_brand,
        "offers_by_category": offers_by_category,
        "top_subcategories": top_subcategories,
        "offer_types": offer_types,
        "discount_histogram": discount_histogram,
        "verification_status": verification_status,
        "monthly_trend": monthly_trend,
        "top_discounted_brands": [{"name": b["brand"], "avg_discount": b["avg_discount"]} for b in top_discounted_brands],
        "brand_performance": brand_performance,
    })
