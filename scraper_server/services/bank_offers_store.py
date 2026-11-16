"""Shared write path for BankCardOffer rows — resolves brand_id via the
existing brand_discovery duplicate-detector, then replaces every row for a
given source_url with a fresh set. Used by both the takhfif.app scrape job
(services/takhfif_scraper.py) and the chrome extension's manual Bank Offers
scan (routers/bank_offers.py's /manual endpoint, for sites too unstructured
for the takhfif job's JSON-LD parsing)."""
import json
from typing import Optional

from database.db import get_session
from database.models import BankCardOffer
from services.brand_discovery.duplicate_detector import find_brand_duplicate


def upsert_place_offers(
    source_url: str,
    place_name: str,
    place_website: Optional[str],
    social_links: Optional[dict],
    offers: list[dict],
) -> int:
    """offers: list of {bank_name, card_name?, discount_percentage?,
    currency?, expiry_date?, description?, max_discount_*?,
    branch_valid_count?, branch_total_count?, valid_branches?}. Returns the
    number of rows written (0 clears out any previous rows for this
    source_url)."""
    brand_id, _score, _reason = find_brand_duplicate(place_name, place_website, social_links or {})

    with get_session() as session:
        session.query(BankCardOffer).filter(BankCardOffer.source_url == source_url).delete()
        for offer in offers:
            session.add(BankCardOffer(
                source_url=source_url,
                place_name=place_name,
                place_website=place_website,
                brand_id=brand_id,
                bank_name=offer["bank_name"],
                card_name=offer.get("card_name"),
                discount_percentage=offer.get("discount_percentage"),
                currency=offer.get("currency"),
                expiry_date=offer.get("expiry_date"),
                description=offer.get("description"),
                max_discount_text=offer.get("max_discount_text"),
                max_discount_amount=offer.get("max_discount_amount"),
                branch_valid_count=offer.get("branch_valid_count"),
                branch_total_count=offer.get("branch_total_count"),
                valid_branches=json.dumps(offer["valid_branches"]) if offer.get("valid_branches") else None,
            ))

    return len(offers)
