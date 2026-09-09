"""Final validation layer for a scraped-website sale candidate — the
website-scraper counterpart to ai/social_offer_analyzer.py. Deliberately its
own small module with its own JSON/normalize helpers (not importing
ai/analyzer.py's or ai/social_offer_analyzer.py's) — same reasoning those two
already give for staying decoupled: different input shape (a compact
extracted-fields payload, never raw HTML), no reason to couple independent
AI call sites together.

Only called for pages services/website_scraper/detectors.py already scored
as "strong" (or "weak" when config.WEBSITE_SCRAPE_AI_ON_WEAK_SIGNAL is on) —
this is the AI half of spec §5/§6: rule-based filtering happens first, AI
only ever sees a compact pre-filtered payload, never full HTML.

Returned dict schema
---------------------
{
    "is_offer": bool,
    "title": str | null,
    "description": str | null,
    "discount_percentage": float | null,
    "coupon_code": str | null,
    "offer_type": str | null,
    "start_date": str | null,
    "end_date": str | null,
    "applicable_scope": str | null,   # e.g. "entire store", "menswear only"
    "confidence": float,               # 0.0 - 1.0
    "reasoning": str,
}
"""
import json
import re
from typing import Optional

from config import logger
from ai._llm import call_llm
from services.settings_service import get_prompt

PROMPT_KEY = "website_offer_analysis"

_PROMPT_TEMPLATE = """\
You are a JSON-only offer-detection engine for brand websites. Given a
compact, pre-filtered extract of one page from a brand's website (never the
full page — navigation/footer/scripts already stripped), decide whether it
describes a real, currently active sale, discount, or promotional offer —
not just a generic product listing — and return a single valid JSON object,
no markdown fences, no prose, matching this schema:

{{
  "is_offer": <true or false>,
  "title": "<short offer title, or null if is_offer is false>",
  "description": "<one or two sentence plain-language summary of the offer, or null>",
  "discount_percentage": <number, or null if not a percentage discount>,
  "coupon_code": "<code if one is mentioned, or null>",
  "offer_type": "<e.g. Percentage Off, BOGO, Flat Sale, Clearance, Free Shipping, Bundle, or null>",
  "start_date": "<ISO date if stated, else null>",
  "end_date": "<ISO date if the page states when the offer ends, else null>",
  "applicable_scope": "<what the offer applies to, e.g. 'entire store', 'menswear only', or null>",
  "confidence": <number 0.0-1.0>,
  "reasoning": "<one or two sentences on why this is or isn't a real active offer>"
}}

Rules:
- is_offer must be false for a normal product/category page with no discount, an expired-sounding "sale ended" message, or vague marketing copy with no concrete discount/price drop.
- Base discount_percentage only on what's explicitly stated or computable from the given prices. Leave null if only vague language like "great savings" is present.
- confidence reflects how clearly the page states a real, current offer — an explicit percentage/coupon code plus a real price drop is high confidence (0.8+); vague language with no specifics is low (below 0.4).
- Return ONLY the JSON object.

--- PAGE EXTRACT ---
Brand: {brand}
URL: {url}
Title: {title}
Sale signals found: {sale_signals}
Prices found: {prices}
Discounts found: {discounts}
Promo codes found: {promo_codes}
Relevant text: {relevant_text}
--- END PAGE EXTRACT ---
"""


def _extract_json(text: str) -> Optional[dict]:
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text)
    text = re.sub(r"```$", "", text.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
    return None


def _safe_confidence(value) -> float:
    try:
        return max(0.0, min(1.0, float(value)))
    except (TypeError, ValueError):
        return 0.0


def _safe_discount(value) -> Optional[float]:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def _normalize(data: dict) -> dict:
    return {
        "is_offer": bool(data.get("is_offer")),
        "title": data.get("title") or None,
        "description": data.get("description") or None,
        "discount_percentage": _safe_discount(data.get("discount_percentage")),
        "coupon_code": data.get("coupon_code") or None,
        "offer_type": data.get("offer_type") or None,
        "start_date": data.get("start_date") or None,
        "end_date": data.get("end_date") or None,
        "applicable_scope": data.get("applicable_scope") or None,
        "confidence": _safe_confidence(data.get("confidence")),
        "reasoning": data.get("reasoning") or "",
    }


def analyze_website_candidate(payload: dict) -> Optional[dict]:
    """Best-effort offer analysis for one compact page payload (see
    services/website_scraper/sale_matcher.py::build_payload). Returns the
    schema dict above, or None if the LLM call itself fails outright (caller
    should treat that as "could not determine", not "not an offer")."""
    template = get_prompt(PROMPT_KEY, default=_PROMPT_TEMPLATE)
    prompt = template.format(
        brand=payload.get("brand") or "(unknown brand)",
        url=payload.get("url") or "",
        title=payload.get("title") or "(no title)",
        sale_signals=json.dumps(payload.get("sale_signals") or []),
        prices=json.dumps(payload.get("prices") or []),
        discounts=json.dumps(payload.get("discounts") or []),
        promo_codes=json.dumps(payload.get("promo_codes") or []),
        relevant_text=(payload.get("relevant_text") or "").strip()[:1500] or "(no text extracted)",
    )

    raw = call_llm(prompt)
    if raw is None:
        logger.error("website_offer_analyzer: no AI response for url=%r", payload.get("url"))
        return None

    parsed = _extract_json(raw)
    if parsed is None:
        logger.error("website_offer_analyzer: unparseable AI response for url=%r", payload.get("url"))
        return None

    return _normalize(parsed)
