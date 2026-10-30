"""
Supabase (PostgreSQL) service for the research module.

Reads brands and writes offers using the existing SQLAlchemy models.
Does NOT modify any existing project file.
"""
import json
import sys
from pathlib import Path
from typing import Optional

# Ensure the project root is on sys.path so existing models can be imported
_PROJECT_ROOT = Path(__file__).parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from database.db import get_session           # existing session context manager
from database.models import Brand, Offer      # existing ORM models

from research.config import logger
from research.models import BrandRecord, ResearchOffer
from research.utils import build_key_highlights, parse_date


class SupabaseService:
    """
    All Supabase read/write operations for the research module.
    Uses the existing get_session() context manager — no new DB connection.
    """

    # ── Brands ────────────────────────────────────────────────────────────────

    def get_active_brands(self) -> list[BrandRecord]:
        """
        SELECT * FROM brands WHERE is_active = true ORDER BY id;
        Returns a list of BrandRecord dataclasses.
        """
        with get_session() as session:
            rows = (
                session.query(Brand)
                .filter(Brand.is_active.is_(True))
                .order_by(Brand.id.asc())
                .all()
            )
            brands = []
            for b in rows:
                try:
                    cats = json.loads(b.categories) if b.categories else []
                except (json.JSONDecodeError, TypeError):
                    cats = []
                brands.append(BrandRecord(
                    id=b.id,
                    name=b.name,
                    website=b.website or "",
                    categories=cats,
                ))
        logger.info("Fetched %d active brand(s) from Supabase.", len(brands))
        return brands

    # ── Duplicate detection ───────────────────────────────────────────────────

    def find_existing_offer(
        self,
        brand_name: str,
        title: str,
        url: Optional[str],
    ) -> Optional[Offer]:
        """
        Look for a previously-researched offer that matches brand + (url or title).
        Matching priority:
          1. brand + url  (most specific)
          2. brand + title (fallback)
        Only matches offers with source='research'.
        """
        with get_session() as session:
            # Priority 1: match by brand + url
            if url:
                existing = (
                    session.query(Offer)
                    .filter(
                        Offer.brand == brand_name,
                        Offer.website == url,
                        Offer.source == "research",
                    )
                    .first()
                )
                if existing:
                    # Detach from session so caller can use it after session closes
                    session.expunge(existing)
                    return existing

            # Priority 2: match by brand + title (summary)
            existing = (
                session.query(Offer)
                .filter(
                    Offer.brand == brand_name,
                    Offer.summary == title,
                    Offer.source == "research",
                )
                .first()
            )
            if existing:
                session.expunge(existing)
                return existing

        return None

    # ── Insert ────────────────────────────────────────────────────────────────

    def insert_offer(self, brand: BrandRecord, offer: ResearchOffer) -> bool:
        """
        Insert a new offer row into the offers table.
        Returns True on success, False on failure.
        """
        highlights = build_key_highlights(offer)
        category = brand.categories[0] if brand.categories else None

        new_offer = Offer(
            email_id=None,
            brand=offer.brand,
            company=brand.name,
            category=category,
            subcategory=None,
            offer_type=offer.offer_type,
            discount_percentage=offer.discount_percentage,
            coupon_code=offer.coupon_code,
            expiry_date=parse_date(offer.end_date),
            offer_value=offer.description or None,
            website=offer.url,
            summary=offer.title,
            key_highlights=json.dumps(highlights),
            is_active=offer.is_sale,
            source="research",
        )

        try:
            with get_session() as session:
                session.add(new_offer)
            logger.info(
                "  ✓ Inserted offer: %r (type=%s, discount=%s%%)",
                offer.title, offer.offer_type,
                f"{offer.discount_percentage:.0f}" if offer.discount_percentage else "?",
            )
            return True
        except Exception as exc:
            logger.error("  ✗ Insert failed for offer %r: %s", offer.title, exc)
            return False

    # ── Update ────────────────────────────────────────────────────────────────

    def update_offer(self, offer_id: int, offer: ResearchOffer) -> bool:
        """
        Update an existing offer row with fresh data from Llama.
        Returns True on success, False on failure.
        """
        highlights = build_key_highlights(offer)

        try:
            with get_session() as session:
                existing = session.query(Offer).filter(Offer.id == offer_id).first()
                if not existing:
                    logger.warning("  Update skipped — offer id=%d not found.", offer_id)
                    return False

                existing.discount_percentage = offer.discount_percentage
                existing.coupon_code = offer.coupon_code
                existing.expiry_date = parse_date(offer.end_date)
                existing.offer_value = offer.description or None
                existing.website = offer.url
                existing.summary = offer.title
                existing.offer_type = offer.offer_type
                existing.key_highlights = json.dumps(highlights)
                existing.is_active = offer.is_sale

            logger.info("  ↺ Updated offer id=%d: %r", offer_id, offer.title)
            return True
        except Exception as exc:
            logger.error("  ✗ Update failed for offer id=%d: %s", offer_id, exc)
            return False

    # ── Mark expired ──────────────────────────────────────────────────────────

    def mark_expired(self, offer_id: int) -> bool:
        """
        Mark an offer as expired/inactive without deleting it.
        Preserves historical records.
        """
        try:
            with get_session() as session:
                existing = session.query(Offer).filter(Offer.id == offer_id).first()
                if existing:
                    existing.is_active = False
            logger.info("  ⏹ Marked offer id=%d as expired.", offer_id)
            return True
        except Exception as exc:
            logger.error("  ✗ Failed to mark offer id=%d expired: %s", offer_id, exc)
            return False

    # ── Save (insert or update) ───────────────────────────────────────────────

    def save_offer(self, brand: BrandRecord, offer: ResearchOffer) -> str:
        """
        Check for an existing duplicate and insert or update accordingly.
        Returns: 'inserted' | 'updated' | 'failed'
        """
        existing = self.find_existing_offer(brand.name, offer.title, offer.url)

        if existing is None:
            success = self.insert_offer(brand, offer)
            return "inserted" if success else "failed"

        # Offer already exists — update it
        success = self.update_offer(existing.id, offer)
        return "updated" if success else "failed"
