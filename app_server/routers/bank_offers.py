import json
from fastapi import APIRouter, Query
from sqlalchemy import func

from database.db import get_session
from database.models import BankCardOffer, Brand, ScrapedBusiness

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

        businesses = []
        for biz, max_discount, bank_count, card_count, bank_names_csv in q.all():
            businesses.append({
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
        return {"businesses": businesses}


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
