"""Overview endpoints — headline KPIs, top brand/category breakdowns, latest
offers. Ported from api/overview.py — logic and response shape unchanged,
only the Flask Blueprint -> FastAPI APIRouter plumbing differs."""
import threading
import time
from datetime import datetime, timedelta

from fastapi import APIRouter
from sqlalchemy import and_, case, func

from database.db import get_session
from database.models import Offer

router = APIRouter(prefix="/api", tags=["overview"])

# Short-TTL in-process cache for the overview payload — see api/overview.py's
# original comment: single-process-with-threads deployment, so a plain
# module-level dict + lock is enough. Unchanged by the FastAPI port.
_OVERVIEW_CACHE_TTL_SECONDS = 10
_overview_cache_lock = threading.Lock()
_overview_cache: dict = {"payload": None, "expires_at": 0.0}


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


@router.get("/overview")
def overview():
    with _overview_cache_lock:
        if _overview_cache["payload"] is not None and time.monotonic() < _overview_cache["expires_at"]:
            return _overview_cache["payload"]

    payload = _build_overview_payload()

    with _overview_cache_lock:
        _overview_cache["payload"] = payload
        _overview_cache["expires_at"] = time.monotonic() + _OVERVIEW_CACHE_TTL_SECONDS

    return payload


def _build_overview_payload() -> dict:
    with get_session() as session:
        now = datetime.utcnow()
        soon = now + timedelta(days=7)

        total_offers, verified, invalid, suspicious, expiring_soon = session.query(
            func.count(Offer.id),
            func.count(case((Offer.verification_status == "verified", 1))),
            func.count(case((Offer.verification_status == "invalid", 1))),
            func.count(case((Offer.verification_status == "suspicious", 1))),
            func.count(case((and_(
                Offer.expiry_date.isnot(None), Offer.expiry_date >= now, Offer.expiry_date <= soon,
            ), 1))),
        ).one()
        unverified = total_offers - verified - invalid - suspicious

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
                "source": o.source,
            }
            for o in latest
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
