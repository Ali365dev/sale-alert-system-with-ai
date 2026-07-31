"""
AI-based brand promotion discovery.

Pipeline per brand:
  1. Search       → DuckDuckGo snippets
  2. Build prompt → brand metadata + search snippets
  3. LLM call     → Gemini (Groq fallback)
  4. Parse        → normalised offer dicts
  5. Update cache → persist next_check, confidence, result count

Public API:
    load_brands()               -> list[dict]
    fetch_offers_for_brand(brand, cache) -> list[dict]

Process brands one at a time — call fetch_offers_for_brand per brand,
save the result immediately, then move to the next brand.
"""
import time
from datetime import datetime, timezone
from typing import Optional
import json

from config import (
    BRAND_RETRY_COUNT,
    logger,
)
from ai._llm import call_llm
from ai import cache as _cache
from ai.search_provider import search_brand
from ai.prompt_builder import build as build_prompt
from ai.parser import parse_response

def load_brands() -> list[dict]:
    """Load active brands from Supabase."""
    try:
        from database.db import get_session
        from database.models import Brand
        with get_session() as session:
            rows = session.query(Brand).filter(Brand.is_active == True).order_by(Brand.name).all()
            return [
                {
                    "name": b.name,
                    "website": b.website or "",
                    "categories": json.loads(b.categories) if b.categories else [],
                }
                for b in rows
            ]
    except Exception as exc:
        logger.error("Could not load brands from DB: %s", exc)
        return []


def fetch_offers_for_brand(brand: dict, cache: Optional[dict] = None) -> list[dict]:
    """
    Run the full pipeline for a single brand.

    Args:
        brand:  Brand dict {name, website, categories}.
        cache:  In-memory cache dict (modified in-place). Pass None to skip caching.

    Returns:
        List of normalized offer dicts with source='ai'.
        Logs search duration, AI duration, and total execution time.
    """
    name  = brand["name"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    t_total = time.monotonic()

    # ── 1. Search ─────────────────────────────────────────────────────────────
    t_search = time.monotonic()
    search_results = search_brand(name)
    search_elapsed = time.monotonic() - t_search

    # ── 2. Build prompt ───────────────────────────────────────────────────────
    prompt = build_prompt(brand, search_results, today)
    logger.debug("Prompt for brand=%r (%d chars):\n%s", name, len(prompt), prompt)

    # ── 3. LLM call (with retry via _llm.call_llm) ────────────────────────────
    t_ai = time.monotonic()
    raw_text = call_llm(prompt, retries=BRAND_RETRY_COUNT)
    ai_elapsed = time.monotonic() - t_ai

    total_elapsed = time.monotonic() - t_total

    if raw_text is None:
        logger.error(
            "LLM returned no response — brand=%r search=%.2fs ai=%.2fs total=%.2fs",
            name, search_elapsed, ai_elapsed, total_elapsed,
        )
        if cache is not None:
            _cache.update(cache, name, success=False, search_source="duckduckgo")
        return []

    # ── 4. Parse ──────────────────────────────────────────────────────────────
    offers = parse_response(raw_text, brand)
    active_count = sum(1 for o in offers if o.get("_is_sale"))
    avg_confidence = (
        sum(o["_confidence"] for o in offers if o.get("_confidence")) / len(offers)
        if offers else 0.0
    )

    logger.info(
        "brand=%r offers=%d active=%d confidence=%.0f%% "
        "search=%.2fs ai=%.2fs total=%.2fs",
        name,
        len(offers),
        active_count,
        avg_confidence * 100,
        search_elapsed,
        ai_elapsed,
        total_elapsed,
    )

    # ── 5. Update cache ───────────────────────────────────────────────────────
    if cache is not None:
        _cache.update(
            cache,
            name,
            success=True,
            confidence=round(avg_confidence, 3),
            search_source="duckduckgo",
            offers_found=len(offers),
            active_offers=active_count,
        )

    return offers


