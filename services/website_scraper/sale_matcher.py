"""Builds the compact AI payload (spec §6 — never full HTML, never nav/
footer) and calls ai/website_offer_analyzer.py. Ported from the research
spike's ai_brief.py pattern: rank by discount, cap examples, strip anything
that isn't a sale signal."""
from __future__ import annotations

from typing import Any

from services.website_scraper.models import ExtractedSaleCandidate

_RELEVANT_TEXT_LIMIT = 1500


def build_payload(brand_name: str | None, candidate: ExtractedSaleCandidate) -> dict[str, Any]:
    page = candidate.page
    sale_signals = list(dict.fromkeys(page.important_text))[:8]

    relevant_text = (page.headline_text or "")
    if len(relevant_text) < _RELEVANT_TEXT_LIMIT:
        relevant_text = (relevant_text + " " + page.body_text).strip()

    return {
        "brand": brand_name,
        "url": page.final_url,
        "title": page.page_title,
        "sale_signals": sale_signals,
        "prices": [
            {"original": p.original, "current": p.current}
            for p in page.detected_prices
            if p.current is not None
        ][:10],
        "discounts": page.discount_percentages[:10],
        "promo_codes": page.coupon_codes[:5],
        "relevant_text": relevant_text[:_RELEVANT_TEXT_LIMIT],
    }


def analyze(brand_name: str | None, candidate: ExtractedSaleCandidate) -> dict | None:
    from ai.website_offer_analyzer import analyze_website_candidate

    payload = build_payload(brand_name, candidate)
    return analyze_website_candidate(payload)
