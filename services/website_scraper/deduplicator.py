"""Duplicate prevention (spec §7). L1 exact-URL, L2 content-hash (handled by
services.py comparing against the previous WebsiteScrapedPage row — see
`previous_page_for`), L3 title/discount/promo-code similarity against other
open website offers for the same brand.

L4 (image hashing) is explicitly deferred — no perceptual-hash infrastructure
exists anywhere in this codebase yet; adding one is out of scope here."""
from __future__ import annotations

import re

from sqlalchemy.orm import Session

from database.models import Offer, WebsiteScrapedPage

_OPEN_STATUSES = ("ACTIVE", "POSSIBLY_ENDED")


def _normalize_title(title: str | None) -> str:
    return re.sub(r"\s+", " ", (title or "").strip().lower())


def previous_page_for(session: Session, brand_id: int | None, url: str, *, exclude_id: int | None = None) -> WebsiteScrapedPage | None:
    """L2 support: the most recent prior scrape of this exact URL, so the
    caller can compare normalized_content_hash and skip AI/offer work when
    nothing changed."""
    q = session.query(WebsiteScrapedPage).filter(WebsiteScrapedPage.url == url)
    if brand_id is not None:
        q = q.filter(WebsiteScrapedPage.brand_id == brand_id)
    if exclude_id is not None:
        q = q.filter(WebsiteScrapedPage.id != exclude_id)
    return q.order_by(WebsiteScrapedPage.id.desc()).first()


def find_offer_by_url(session: Session, source_url: str) -> Offer | None:
    """L1: exact offer-URL match among website-sourced offers. Offer has no
    brand_id FK (Offer.brand is a name string, same as every other source) —
    source_url is already a strong enough key on its own since it's the
    specific scraped page URL, not a generic brand link."""
    return (
        session.query(Offer)
        .filter(Offer.source == "website", Offer.source_url == source_url)
        .order_by(Offer.id.desc())
        .first()
    )


def find_similar_offer(
    session: Session, brand_id: int | None, brand_name: str | None, ai_result: dict,
) -> Offer | None:
    """L3: same brand + (title match, or discount+promo-code match) among
    currently-open website offers — used when the URL changed slightly
    (query params, redirects) but it's clearly the same sale."""
    if brand_name is None:
        return None
    q = session.query(Offer).filter(
        Offer.source == "website",
        Offer.brand == brand_name,
        Offer.closure_status.in_(_OPEN_STATUSES),
    )
    candidates = q.order_by(Offer.id.desc()).limit(50).all()
    target_title = _normalize_title(ai_result.get("title"))
    target_discount = ai_result.get("discount_percentage")
    target_code = (ai_result.get("coupon_code") or "").strip().lower() or None

    for offer in candidates:
        if target_title and _normalize_title(offer.title) == target_title:
            return offer
        if target_discount is not None and offer.discount_percentage == target_discount:
            if target_code and target_code == (offer.coupon_code or "").strip().lower():
                return offer
    return None
