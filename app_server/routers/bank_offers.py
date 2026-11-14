import json
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse
from sqlalchemy import func

from database.db import get_session
from database.models import BankCardOffer, Brand, Business as ScrapedBusiness, BusinessBranch

router = APIRouter(prefix="/api/bank-offers", tags=["bank_offers"])


def _row_to_dict(row: BankCardOffer, brand_name: str, biz: ScrapedBusiness | None) -> dict:
    return {
        "brand_id": row.brand_id,
        "brand_name": brand_name,
        "place_name": row.place_name,
        "bank_name": row.bank_name,
        "card_name": row.card_name,
        "discount_percentage": row.discount_percentage,
        "max_discount_text": row.max_discount_text,
        "max_discount_amount": row.max_discount_amount,
        "valid_days": json.loads(row.valid_days) if row.valid_days else [],
        "terms": json.loads(row.terms) if row.terms else [],
        "currency": row.currency,
        "expiry_date": row.expiry_date.isoformat() if row.expiry_date else None,
        "description": row.description,
        # Enrichment from scraped_businesses (null when not yet imported via extension)
        "city": biz.city if biz else None,
        "cover_image_url": biz.cover_image_url if biz else None,
        "logo_url": biz.logo_url if biz else None,
        "rating": biz.rating if biz else None,
        "review_count": biz.review_count if biz else None,
        "category": biz.category if biz else None,
        "source_url": biz.source_url if biz else row.source_url,
    }


@router.get("/businesses")
def list_scraped_businesses(
    city: str | None = Query(default=None),
    brand_id: int | None = Query(default=None),
):
    """List of scraped businesses from takhfif.app with aggregated bank offer
    counts — powers the Bank Offers screen on the mobile app."""
    with get_session() as session:
        q = (
            session.query(
                ScrapedBusiness,
                func.max(BankCardOffer.discount_percentage).label("max_discount"),
                func.count(func.distinct(BankCardOffer.bank_name)).label("bank_count"),
                func.count(BankCardOffer.id).label("card_count"),
                func.string_agg(func.distinct(BankCardOffer.bank_name), ",").label("bank_names"),
            )
            .join(BankCardOffer, BankCardOffer.business_id == ScrapedBusiness.id)
            .filter(BankCardOffer.is_active.is_(True))
            .filter(ScrapedBusiness.is_active.is_(True))
            .group_by(ScrapedBusiness.id)
        )
        if city:
            q = q.filter(ScrapedBusiness.city.ilike(f"%{city}%"))
        if brand_id is not None:
            q = q.filter(ScrapedBusiness.brand_id == brand_id)

        raw = []
        for biz, max_discount, bank_count, card_count, bank_names_csv in q.all():
            raw.append({
                "id": biz.id,
                "slug": biz.slug,
                "name": biz.name,
                "category": biz.category,
                "city": biz.city,
                "rating": biz.rating,
                "review_count": biz.review_count,
                "logo_url": biz.logo_url,
                "cover_image_url": biz.cover_image_url,
                "source_url": biz.source_url,
                "brand_id": biz.brand_id,
                "max_discount": round(max_discount) if max_discount else None,
                "bank_count": bank_count,
                "card_count": card_count,
                "bank_names": bank_names_csv.split(",") if bank_names_csv else [],
            })

        # Deduplicate by brand_id: keep the entry with the most card offers per brand.
        # Businesses without a brand_id always pass through unchanged.
        seen: dict[int, int] = {}  # brand_id -> index in `businesses`
        businesses = []
        for b in raw:
            bid = b["brand_id"]
            if bid is None:
                businesses.append(b)
            elif bid not in seen:
                seen[bid] = len(businesses)
                businesses.append(b)
            else:
                idx = seen[bid]
                if b["card_count"] > businesses[idx]["card_count"]:
                    # Keep richer entry; merge city string if different
                    if businesses[idx]["city"] and b["city"] and businesses[idx]["city"] != b["city"]:
                        b["city"] = f"{businesses[idx]['city']}, {b['city']}"
                    businesses[idx] = b

        return {"businesses": businesses}


@router.get("/businesses/{business_id}")
def get_business_detail(business_id: int):
    """Full detail for one scraped business — powers the BankOfferDetailScreen."""
    with get_session() as session:
        biz = session.query(ScrapedBusiness).filter(
            ScrapedBusiness.id == business_id,
            ScrapedBusiness.is_active.is_(True),
        ).first()
        if not biz:
            return JSONResponse({"error": "not found"}, status_code=404)

        offers_q = (
            session.query(BankCardOffer)
            .filter(BankCardOffer.business_id == business_id)
            .filter(BankCardOffer.is_active.is_(True))
            .order_by(BankCardOffer.bank_name, BankCardOffer.discount_percentage.desc())
        )

        # Group offers by bank_name
        banks: dict = {}
        for offer in offers_q.all():
            bn = offer.bank_name or "Unknown"
            if bn not in banks:
                banks[bn] = {
                    "bank_name": bn,
                    "max_discount": offer.discount_percentage or 0,
                    "max_discount_text": offer.max_discount_text,
                    "max_discount_amount": offer.max_discount_amount,
                    "currency": offer.currency or "PKR",
                    "cards": [],
                    "terms": json.loads(offer.terms) if offer.terms else [],
                    "valid_days": json.loads(offer.valid_days) if offer.valid_days else [],
                }
            else:
                if (offer.discount_percentage or 0) > banks[bn]["max_discount"]:
                    banks[bn]["max_discount"] = offer.discount_percentage
                    banks[bn]["max_discount_text"] = offer.max_discount_text
                    banks[bn]["max_discount_amount"] = offer.max_discount_amount
                # Merge terms if any new ones
                extra_terms = json.loads(offer.terms) if offer.terms else []
                for t in extra_terms:
                    if t not in banks[bn]["terms"]:
                        banks[bn]["terms"].append(t)

            banks[bn]["cards"].append({
                "card_name": offer.card_name or "",
                "discount_percentage": offer.discount_percentage or 0,
                "max_discount_text": offer.max_discount_text,
                "max_discount_amount": offer.max_discount_amount,
                "description": offer.description or "",
                "expiry_date": offer.expiry_date.isoformat() if offer.expiry_date else None,
            })

        def _safe_json(val):
            if not val:
                return None
            try:
                return json.loads(val)
            except Exception:
                return None

        # Prefer BusinessBranch table rows (kept current by scraper); fall back to legacy JSON column.
        branch_rows = (
            session.query(BusinessBranch)
            .filter(BusinessBranch.business_id == business_id)
            .all()
        )
        branches = [
            {
                "id": br.id, "name": br.name, "address": br.address,
                "city": br.city, "area": br.area,
                "latitude": br.latitude, "longitude": br.longitude,
                "phone": br.phone, "opening_hours": br.opening_hours,
                "directions_url": br.directions_url, "place_id": br.place_id,
            }
            for br in branch_rows
        ] or _safe_json(biz.branches) or []

        return {
            "business": {
                "id": biz.id,
                "slug": biz.slug,
                "name": biz.name,
                "category": biz.category,
                "city": biz.city,
                "description": biz.description,
                "rating": biz.rating,
                "review_count": biz.review_count,
                "phone": biz.phone,
                "website": biz.website,
                "logo_url": biz.logo_url,
                "cover_image_url": biz.cover_image_url,
                "source_url": biz.source_url,
                "brand_id": biz.brand_id,
                "branches": branches,
                "gallery": _safe_json(biz.gallery) or [],
                "social_links": _safe_json(biz.social_links) or {},
                "last_scraped_at": biz.last_scraped_at.isoformat() if biz.last_scraped_at else None,
            },
            "bank_offers": list(banks.values()),
        }


@router.get("/bank-counts")
def get_bank_offer_counts():
    """Returns offer count per bank_name — powers the Supported Banks list in MyCardsScreen."""
    with get_session() as session:
        rows = (
            session.query(BankCardOffer.bank_name, func.count(BankCardOffer.id).label("count"))
            .filter(BankCardOffer.is_active.is_(True))
            .group_by(BankCardOffer.bank_name)
            .all()
        )
        return {"counts": {bank_name: count for bank_name, count in rows if bank_name}}


@router.get("")
def list_bank_offers(brand_id: int | None = Query(default=None)):
    with get_session() as session:
        q = (
            session.query(BankCardOffer, Brand.name, ScrapedBusiness)
            .join(Brand, Brand.id == BankCardOffer.brand_id)
            .outerjoin(ScrapedBusiness, ScrapedBusiness.id == BankCardOffer.business_id)
            .filter(BankCardOffer.is_active.is_(True))
        )
        if brand_id is not None:
            q = q.filter(BankCardOffer.brand_id == brand_id)

        return {
            "offers": [_row_to_dict(row, brand_name, biz) for row, brand_name, biz in q.all()],
        }
