"""Turns an ai/website_offer_analyzer.py result into a created/updated Offer
row — the website-scraper counterpart to services/social_scraper/
offer_builder.py::build_offer_from_social. Deliberately its own function
rather than a shared helper, per this codebase's established convention of
keeping independent offer-creation call sites decoupled (see that module's
own docstring for the same reasoning)."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from database.models import Brand, Offer, WebsiteScrapedPage
from database.offer_retention import compute_delete_after, utcnow
from services.website_scraper.deduplicator import find_offer_by_url, find_similar_offer


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%B %d, %Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(date_str, fmt)
        except (ValueError, TypeError):
            continue
    return None


def create_or_update_offer(session, page: WebsiteScrapedPage, ai_result: dict, brand: Optional[Brand]) -> tuple[Offer, bool]:
    """Returns (offer, was_created). Applies dedup L1 (exact source_url) then
    L3 (title/discount/promo-code similarity) before inserting a new row —
    spec §7/§17: update the existing offer rather than duplicating it."""
    now = utcnow()
    brand_name = brand.name if brand else None
    source_url = page.final_url or page.url

    existing = find_offer_by_url(session, source_url) or find_similar_offer(session, None, brand_name, ai_result)
    end_date = _parse_date(ai_result.get("end_date"))

    if existing is not None:
        existing.title = (ai_result.get("title") or existing.title or "")[:500] or None
        existing.summary = ai_result.get("description") or existing.summary
        existing.discount_percentage = ai_result.get("discount_percentage") if ai_result.get("discount_percentage") is not None else existing.discount_percentage
        existing.coupon_code = ai_result.get("coupon_code") or existing.coupon_code
        existing.offer_type = ai_result.get("offer_type") or existing.offer_type
        existing.expiry_date = end_date or existing.expiry_date
        existing.website = source_url
        existing.source_url = source_url
        existing.last_seen_at = now
        existing.last_verified_at = now
        existing.missing_count = 0
        existing.closure_status = "ACTIVE"
        existing.is_active = True
        return existing, False

    offer = Offer(
        email_id=None,
        title=(ai_result.get("title") or "")[:500] or None,
        brand=brand_name,
        company=None,
        category=None,
        subcategory=None,
        offer_type=ai_result.get("offer_type"),
        discount_percentage=ai_result.get("discount_percentage"),
        coupon_code=ai_result.get("coupon_code"),
        expiry_date=end_date,
        expiry_date_basis="explicit" if end_date else "none",
        expiry_date_confidence=None,
        delete_after=compute_delete_after(end_date, now),
        offer_value=None,
        website=source_url,
        summary=ai_result.get("description"),
        key_highlights=None,
        is_active=True,
        source="website",
        source_url=source_url,
        closure_status="ACTIVE",
        missing_count=0,
        first_seen_at=now,
        last_seen_at=now,
        last_verified_at=now,
    )
    session.add(offer)
    session.flush()
    return offer, True
