"""Public, read-only bank-card offers for brands already in this app's
catalog — scraped from takhfif.app by scraper_server (see
scraper_server/services/takhfif_scraper.py) and matched to Brand rows there.
Only matched rows (brand_id set) are ever returned here."""
from fastapi import APIRouter, Query

from database.db import get_session
from database.models import BankCardOffer, Brand

router = APIRouter(prefix="/api/bank-offers", tags=["bank_offers"])


def _row_to_dict(row: BankCardOffer, brand_name: str) -> dict:
    return {
        "brand_id": row.brand_id,
        "brand_name": brand_name,
        "bank_name": row.bank_name,
        "card_name": row.card_name,
        "discount_percentage": row.discount_percentage,
        "currency": row.currency,
        "expiry_date": row.expiry_date.isoformat() if row.expiry_date else None,
        "description": row.description,
    }


@router.get("")
def list_bank_offers(brand_id: int | None = Query(default=None)):
    with get_session() as session:
        q = (
            session.query(BankCardOffer, Brand.name)
            .join(Brand, Brand.id == BankCardOffer.brand_id)
            .filter(BankCardOffer.is_active.is_(True))
        )
        if brand_id is not None:
            q = q.filter(BankCardOffer.brand_id == brand_id)

        return {
            "offers": [_row_to_dict(row, brand_name) for row, brand_name in q.all()],
        }
