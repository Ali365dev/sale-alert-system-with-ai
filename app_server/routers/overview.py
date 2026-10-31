"""Overview endpoints — headline KPIs, top brand/category breakdowns, latest
offers. Ported from api/overview.py — logic and response shape unchanged,
only the Flask Blueprint -> FastAPI APIRouter plumbing differs."""
import threading
import time
from datetime import datetime, timedelta

from fastapi import APIRouter, Query
from sqlalchemy import and_, case, func

from database.db import get_session
from database.models import Brand, Offer

router = APIRouter(prefix="/api", tags=["overview"])

_OVERVIEW_CACHE_TTL_SECONDS = 10
_overview_cache_lock = threading.Lock()
# Cache keyed by region (None = all countries)
_overview_cache: dict[str | None, dict] = {}


def _top_counts(session, column, brand_names: set[str] | None, limit=8):
    q = session.query(column, func.count(Offer.id)).filter(column.isnot(None))
    if brand_names is not None:
        q = q.filter(Offer.brand.in_(brand_names))
    rows = q.group_by(column).order_by(func.count(Offer.id).desc()).limit(limit).all()
    return [{"name": name, "count": count} for name, count in rows]


@router.get("/overview")
def overview(region: str | None = Query(None)):
    key = region.upper() if region else None

    with _overview_cache_lock:
        cached = _overview_cache.get(key)
        if cached and time.monotonic() < cached["expires_at"]:
            return cached["payload"]

    payload = _build_overview_payload(key)

    with _overview_cache_lock:
        _overview_cache[key] = {"payload": payload, "expires_at": time.monotonic() + _OVERVIEW_CACHE_TTL_SECONDS}

    return payload


def _build_overview_payload(region: str | None) -> dict:
    with get_session() as session:
        now = datetime.utcnow()
        soon = now + timedelta(days=7)

        brand_names: set[str] | None = None
        if region:
            brand_names = {
                b.name for b in session.query(Brand).filter(
                    Brand.country == region, Brand.name.isnot(None)
                ).all()
            }

        base_q = session.query(Offer)
        if brand_names is not None:
            base_q = base_q.filter(Offer.brand.in_(brand_names))

        total_offers, verified, invalid, suspicious, expiring_soon = base_q.with_entities(
            func.count(Offer.id),
            func.count(case((Offer.verification_status == "verified", 1))),
            func.count(case((Offer.verification_status == "invalid", 1))),
            func.count(case((Offer.verification_status == "suspicious", 1))),
            func.count(case((and_(
                Offer.expiry_date.isnot(None), Offer.expiry_date >= now, Offer.expiry_date <= soon,
            ), 1))),
        ).one()
        unverified = total_offers - verified - invalid - suspicious

        top_brands = _top_counts(session, Offer.brand, brand_names)
        top_categories = _top_counts(session, Offer.category, brand_names)
        top_subcategories = _top_counts(session, Offer.subcategory, brand_names)

        latest_q = base_q.order_by(Offer.created_at.desc()).limit(20)
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
                "source": o.source,
            }
            for o in latest_q.all()
        ]

    return {
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
    }
