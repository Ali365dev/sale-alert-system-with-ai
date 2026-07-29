"""
Data models for the research module.
Pure Python dataclasses — no external dependencies.
"""
from dataclasses import dataclass, field
from typing import Optional

VALID_OFFER_TYPES = frozenset({
    "percentage_discount",
    "flat_discount",
    "bogo",
    "free_shipping",
    "bundle",
    "clearance",
    "student_discount",
    "member_only",
    "cashback",
    "gift_with_purchase",
    "first_order",
    "flash_sale",
    "seasonal",
    "no_sale",
})


@dataclass
class BrandRecord:
    """A brand row fetched from Supabase."""
    id: int
    name: str
    website: str
    categories: list


@dataclass
class ResearchOffer:
    """
    A single offer extracted by Llama from Tavily search results.
    Fields map to the existing `offers` table in Supabase.
    """
    brand: str
    title: str                        # → Offer.summary
    description: str                  # → Offer.offer_value
    offer_type: str
    is_sale: bool
    free_shipping: bool
    student_discount: bool
    member_only: bool
    confidence: float
    source: str = "research"
    discount_percentage: Optional[float] = None
    coupon_code: Optional[str] = None
    start_date: Optional[str] = None  # YYYY-MM-DD (stored in key_highlights)
    end_date: Optional[str] = None    # YYYY-MM-DD → Offer.expiry_date
    url: Optional[str] = None         # → Offer.website

    def __post_init__(self) -> None:
        if self.offer_type not in VALID_OFFER_TYPES:
            self.offer_type = "no_sale"

        try:
            self.confidence = max(0.0, min(1.0, float(self.confidence or 0.0)))
        except (TypeError, ValueError):
            self.confidence = 0.0

        if self.discount_percentage is not None:
            try:
                v = float(self.discount_percentage)
                self.discount_percentage = max(0.0, min(100.0, v))
            except (TypeError, ValueError):
                self.discount_percentage = None

        self.coupon_code = self.coupon_code or None
        self.url = self.url or None


@dataclass
class ResearchResult:
    """Outcome of processing one brand."""
    brand_id: int
    brand_name: str
    offers_found: int = 0
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    error: Optional[str] = None

    @property
    def success(self) -> bool:
        return self.error is None
