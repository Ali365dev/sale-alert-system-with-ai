"""Plain dataclasses passed between pipeline stages — never persisted
directly (services.py maps these onto WebsiteScrapedPage/Offer rows)."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class DiscoveredUrl:
    url: str
    page_type: str  # "homepage" | "sale" | "offers" | "promotions" | "custom" | "discovered"
    score: int = 0


@dataclass
class PriceInfo:
    original: float | None = None
    current: float | None = None


@dataclass
class RawPage:
    """Fetched + parsed content for one URL, before hashing/scoring."""
    url: str
    final_url: str
    http_status: int
    html: str
    page_title: str | None = None
    meta_description: str | None = None
    canonical_url: str | None = None
    headline_text: str = ""
    body_text: str = ""
    important_text: list[str] = field(default_factory=list)
    images: list[str] = field(default_factory=list)
    image_alt_text: list[str] = field(default_factory=list)
    detected_prices: list[PriceInfo] = field(default_factory=list)
    discount_percentages: list[float] = field(default_factory=list)
    coupon_codes: list[str] = field(default_factory=list)
    links: list[str] = field(default_factory=list)


@dataclass
class ExtractedSaleCandidate:
    """A RawPage after normalization/hashing/rule-scoring — what gets handed
    to sale_matcher.py for the (optional) AI confirmation step."""
    page: RawPage
    page_content_hash: str
    normalized_content_hash: str
    sale_score: float
    rule_status: str  # "not_sale" | "weak" | "strong"


@dataclass
class AiOfferResult:
    is_offer: bool
    title: str | None = None
    description: str | None = None
    discount_percentage: float | None = None
    coupon_code: str | None = None
    offer_type: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    applicable_scope: str | None = None
    confidence: float = 0.0
    reasoning: str = ""
