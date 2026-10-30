"""Rule-based sale scoring (spec §5) — cheap filtering layer before any AI
call. Extends the keyword/price-pattern regexes validated in the research
spike's sale_detector.py into a 0-100 score with three tiers:

  0-20   not_sale  -> store only, never call AI
  21-50  weak      -> store candidate, AI call gated by
                      config.WEBSITE_SCRAPE_AI_ON_WEAK_SIGNAL
  51-100 strong     -> always send the compact payload to AI

Deliberately independent from ai/sale_filter.py (email/social's equivalent)
— same "don't couple independent call sites" convention already established
in this codebase (ai/social_offer_analyzer.py vs ai/analyzer.py)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from urllib.parse import urlparse

from services.website_scraper.models import RawPage

NOT_SALE = "not_sale"
WEAK = "weak"
STRONG = "strong"

WEAK_TERMS = (
    "sale", "discount", "offer", "deal", "promotion", "save", "reduced",
    "special price", "was", "now", "free shipping",
)
STRONG_PATTERNS = (
    re.compile(r"\bup\s*to\s*\d{1,3}\s*%\s*off\b", re.I),
    re.compile(r"\b\d{1,3}\s*%\s*off\b", re.I),
    re.compile(r"\bflat\s+\d{1,3}\s*%\b", re.I),
    re.compile(r"\bclearance\b", re.I),
    re.compile(r"\blimited[\s-]time\s+offer\b", re.I),
    re.compile(r"\b(?:promo|coupon)\s*code\b", re.I),
    re.compile(r"\bbogo\b|\bbuy\s+one\s+get\s+one\b", re.I),
    re.compile(r"\bend\s+of\s+season\s+sale\b", re.I),
)

# Page types that are explicitly sale hubs (DB promo URLs or nav sale links).
_PROMO_PAGE_TYPES = frozenset({"sale", "offers", "promotions", "custom", "nav_footer"})
_SALE_PATH_MARKERS = (
    "/sale", "/sales", "/offer", "/offers", "/promo", "/promotion", "/promotions",
    "/clearance", "/outlet", "/deal", "/deals", "-sale", "_sale",
)

WEAK_POINTS = 3
STRONG_PATTERN_POINTS = 15
PRICE_DROP_POINTS = 20
DISCOUNT_FIELD_POINTS = 25
COUPON_FIELD_POINTS = 10
# Sale hub URL / configured promo page — without this, weak keywords alone
# cap at 15 which is still NOT_SALE (ceiling 20), so AI never runs and no
# Offer is created even on /collections/sale pages.
SALE_HUB_POINTS = 25
WEAK_CAP = 15  # at most 5 weak-term hits count

NOT_SALE_CEILING = 20
WEAK_CEILING = 50


@dataclass
class SaleRelevance:
    score: float
    status: str
    reason: str


def extract_signals(page: RawPage, *, limit: int = 8) -> list[str]:
    """Short human-readable snippets naming *why* a page looks sale-related
    — becomes WebsiteScrapedPage.important_text and feeds the AI payload."""
    text = re.sub(r"\s+", " ", f"{page.page_title or ''} {page.headline_text} {page.body_text}").strip()
    found: list[str] = []
    seen: set[str] = set()
    for pattern in STRONG_PATTERNS:
        for match in pattern.finditer(text):
            snippet = match.group(0).strip(" |")
            key = snippet.lower()
            if len(snippet) < 3 or key in seen:
                continue
            seen.add(key)
            found.append(snippet[:120])
            if len(found) >= limit:
                return found
    return found


def _looks_like_sale_hub(page: RawPage, page_type: str | None) -> bool:
    if page_type in _PROMO_PAGE_TYPES:
        return True
    path = urlparse(page.final_url or page.url or "").path.lower()
    return any(marker in path for marker in _SALE_PATH_MARKERS)


def evaluate(page: RawPage, *, page_type: str | None = None) -> SaleRelevance:
    text = f"{page.page_title or ''} {page.headline_text} {page.body_text}".lower()
    if not text.strip() and not page.discount_percentages and not page.detected_prices:
        # Configured sale URLs with empty extract still deserve a weak pass so
        # AI can decide — otherwise promos never become Offers.
        if _looks_like_sale_hub(page, page_type):
            return SaleRelevance(
                score=float(SALE_HUB_POINTS),
                status=WEAK,
                reason="sale/promo hub URL with little extractable text",
            )
        return SaleRelevance(score=0.0, status=NOT_SALE, reason="no extractable content")

    score = 0.0
    reasons: list[str] = []

    weak_hits = sum(1 for term in WEAK_TERMS if term in text)
    if weak_hits:
        score += min(weak_hits, 5) * WEAK_POINTS
        reasons.append(f"{weak_hits} weak keyword(s)")

    strong_hits = [p.pattern for p in STRONG_PATTERNS if p.search(text)]
    if strong_hits:
        score += len(strong_hits) * STRONG_PATTERN_POINTS
        reasons.append(f"{len(strong_hits)} strong pattern(s)")

    if page.discount_percentages:
        score += DISCOUNT_FIELD_POINTS
        reasons.append(f"discount field(s): {page.discount_percentages[:3]}")

    has_real_price_drop = any(
        p.original and p.current and p.original > p.current for p in page.detected_prices
    )
    if has_real_price_drop:
        score += PRICE_DROP_POINTS
        reasons.append("was/now price drop detected")

    if page.coupon_codes:
        score += COUPON_FIELD_POINTS
        reasons.append(f"{len(page.coupon_codes)} promo code(s)")

    if _looks_like_sale_hub(page, page_type):
        score += SALE_HUB_POINTS
        reasons.append("sale/promo hub URL or configured promo page")

    score = min(score, 100.0)
    if score <= NOT_SALE_CEILING:
        status = NOT_SALE
    elif score <= WEAK_CEILING:
        status = WEAK
    else:
        status = STRONG

    return SaleRelevance(score=score, status=status, reason="; ".join(reasons) or "no sale signals found")
