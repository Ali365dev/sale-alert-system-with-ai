"""Turns an ai/social_offer_analyzer.py result into an unsaved Offer row —
the social-post counterpart to ai/analyzer.py::build_offer. Deliberately its
own small function rather than a shared helper: the two sources genuinely
differ (email_id vs. none, subject-as-title vs. AI-generated title, sender-
based brand inference vs. an explicit brand_id), and this codebase already
keeps ai/brand_identifier.py independent from ai/analyzer.py for the same
reason — not worth coupling two independent call sites together."""
from datetime import datetime
from typing import Optional

from database.models import Brand, Offer, SocialPost
from database.offer_retention import compute_delete_after, utcnow


def _parse_explicit_expiry(date_str) -> Optional[datetime]:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%B %d, %Y", "%Y-%m-%dT%H:%M:%S"):
        try:
            return datetime.strptime(date_str, fmt)
        except (ValueError, TypeError):
            continue
    return None


def build_offer_from_social(post: SocialPost, result: dict, brand: Optional[Brand]) -> Offer:
    """`post` must already have its id/platform/post_url/image_url set.
    `brand` is the linked Brand row if post.brand_id is set, else None —
    used only to fill Offer.brand by name (a Test-page ad-hoc post has no
    brand, so Offer.brand stays null, same as an unmatched email offer)."""
    # scraped_at is DB-defaulted at insert time so this is normally always
    # set by the time a post reaches here — the utcnow() fallback is a
    # defensive backstop, not the expected path (mirrors ai/analyzer.py::
    # build_offer's own `received_at or utcnow()`).
    received_at = post.scraped_at or post.post_date or utcnow()
    expiry_date = _parse_explicit_expiry(result.get("expiry_date"))

    return Offer(
        email_id=None,
        title=(result.get("title") or "")[:500] or None,
        brand=brand.name if brand else None,
        company=None,
        category=result.get("category"),
        subcategory=result.get("subcategory"),
        offer_type=result.get("offer_type"),
        discount_percentage=result.get("discount_percentage"),
        coupon_code=result.get("coupon_code"),
        expiry_date=expiry_date,
        expiry_date_basis="explicit" if expiry_date else "none",
        expiry_date_confidence=None,
        delete_after=compute_delete_after(expiry_date, received_at),
        offer_value=None,
        website=post.post_url,
        summary=result.get("description"),
        key_highlights=None,
        is_active=True,
        source="social",
    )
