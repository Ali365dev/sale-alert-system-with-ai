"""Determines whether a scraped-social-post's combined content (caption +
OCR text from its image) is a genuine offer, and if so extracts structured
offer fields — the social-post counterpart to ai/analyzer.py's email offer
extraction. Deliberately its own small module with its own JSON/normalize
helpers (not importing ai/analyzer.py's) — same reasoning ai/brand_identifier.py
gives for doing the same: different content shape (no sender/subject), no
reason to couple two independent AI call sites together.

Only called when ai/sale_filter.py's keyword-based evaluate() didn't already
rule the post out (see services/social_scraper/content_pipeline.py) — this
is the AI half of "use both keyword detection and AI analysis" from the
Social Media Offer Discovery spec.

Returned dict schema
---------------------
{
    "is_offer": bool,
    "title": str | null,
    "description": str | null,
    "discount_percentage": float | null,
    "coupon_code": str | null,
    "offer_type": str | null,
    "category": str | null,
    "subcategory": str | null,
    "expiry_date": str | null,   # ISO date/datetime if stated, else null
    "confidence": float,          # 0.0 - 1.0
    "reasoning": str,
}
"""
import json
import re
from typing import Optional

from config import logger
from ai._llm import call_llm
from services.settings_service import get_prompt

PROMPT_KEY = "social_offer_analysis"

_PROMPT_TEMPLATE = """\
You are a JSON-only offer-detection engine for social media posts. Given a
brand's {platform} post (caption plus any text read via OCR from its image),
decide whether it actually advertises a sale, discount, promotion, or
special deal — not just a general brand/product post — and return a single
valid JSON object, no markdown fences, no prose, matching this schema:

{{
  "is_offer": <true or false>,
  "title": "<short offer title, or null if is_offer is false>",
  "description": "<one or two sentence plain-language summary of the offer, or null>",
  "discount_percentage": <number, or null if not a percentage discount>,
  "coupon_code": "<code if one is mentioned, or null>",
  "offer_type": "<e.g. Percentage Off, BOGO, Flat Sale, Clearance, Free Gift, Bundle, or null>",
  "category": "<top-level category, e.g. Fashion, Electronics, Beauty, Food, Travel, Sport, Home, Gaming, General>",
  "subcategory": "<more specific category, or null>",
  "expiry_date": "<ISO date/datetime if the post states when the offer ends, else null>",
  "confidence": <number 0.0-1.0>,
  "reasoning": "<one or two sentences on why this is or isn't an offer>"
}}

Rules:
- is_offer must be false for ordinary brand content — new-arrival announcements with no discount, behind-the-scenes posts, general engagement posts, giveaways with no purchase-related discount, etc.
- Base discount_percentage only on what's explicitly stated (e.g. "50% off", "up to 30% off" -> 30). Leave null if only vague language like "big savings" is used with no number.
- confidence reflects how clearly the post states a real, current offer — an explicit percentage/coupon code is high confidence (0.8+); vague promotional language with no specifics is low (below 0.4).
- Return ONLY the JSON object.

--- POST ({platform}) ---
Caption: {caption}

OCR text from image: {ocr_text}
--- END POST ---
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
        "category": data.get("category") or None,
        "subcategory": data.get("subcategory") or None,
        "expiry_date": data.get("expiry_date") or None,
        "confidence": _safe_confidence(data.get("confidence")),
        "reasoning": data.get("reasoning") or "",
    }


def analyze_social_post(caption: str, ocr_text: str, platform: str) -> Optional[dict]:
    """Best-effort offer analysis for one social post. Returns the schema
    dict above, or None if the LLM call itself fails outright (caller should
    treat that as "could not determine", not "not an offer")."""
    template = get_prompt(PROMPT_KEY, default=_PROMPT_TEMPLATE)
    prompt = template.format(
        platform=platform or "social media",
        caption=(caption or "").strip()[:3000] or "(no caption)",
        ocr_text=(ocr_text or "").strip()[:3000] or "(no text found in image)",
    )

    raw = call_llm(prompt)
    if raw is None:
        logger.error("social_offer_analyzer: no AI response for platform=%r", platform)
        return None

    parsed = _extract_json(raw)
    if parsed is None:
        logger.error("social_offer_analyzer: unparseable AI response for platform=%r", platform)
        return None

    return _normalize(parsed)
