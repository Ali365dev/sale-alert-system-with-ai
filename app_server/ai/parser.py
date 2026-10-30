"""
Parses the raw LLM response and normalises each offer to the DB Offer schema.
source is always "ai" for brand-fetched offers.
"""
import json
import logging
import re
from datetime import datetime
from typing import Optional

logger = logging.getLogger(__name__)


def _extract_json(text: str) -> Optional[dict]:
    """Try multiple strategies to pull a JSON object out of an LLM response."""
    text = text.strip()

    # Strip all markdown code fences (anywhere in the text)
    text = re.sub(r"```(?:json)?", "", text).strip()

    # Strategy 1: the whole response is valid JSON
    try:
        data = json.loads(text)
        if isinstance(data, list):
            return {"offers": data}
        return data
    except json.JSONDecodeError:
        pass

    # Strategy 2: find the outermost {...} object
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        try:
            data = json.loads(match.group())
            if isinstance(data, list):
                return {"offers": data}
            return data
        except json.JSONDecodeError:
            pass

    # Strategy 3: find a top-level [...] array and wrap it
    match = re.search(r"\[[\s\S]*\]", text)
    if match:
        try:
            data = json.loads(match.group())
            if isinstance(data, list):
                return {"offers": data}
        except json.JSONDecodeError:
            pass

    return None


def _parse_date(val) -> Optional[datetime]:
    if not val:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%B %d, %Y"):
        try:
            return datetime.strptime(str(val), fmt)
        except (ValueError, TypeError):
            continue
    return None


def _safe_float(val, lo: float = 0.0, hi: float = 100.0) -> Optional[float]:
    try:
        v = float(val)
        return max(lo, min(hi, v))
    except (TypeError, ValueError):
        return None


def _normalize(raw: dict, brand: dict) -> dict:
    """Map a single AI offer dict → DB Offer schema with source='ai'."""
    is_sale = bool(raw.get("is_sale", False))

    highlights = [
        raw.get("description") or "",
    ]
    if raw.get("free_shipping"):
        highlights.append("Free shipping available")
    if raw.get("student_discount"):
        highlights.append("Student discount available")
    if raw.get("member_only"):
        highlights.append("Members only offer")
    conf = raw.get("confidence")
    if conf is not None:
        highlights.append(f"AI confidence: {float(conf):.0%}")
    if raw.get("url"):
        highlights.append(f"Source: {raw['url']}")

    return {
        # ── core offer fields (match DB schema) ───────────────────────────────
        "brand":               raw.get("brand") or brand["name"],
        "company":             brand["name"],
        "category":            (brand.get("categories") or ["Other"])[0],
        "subcategory":         None,
        "offer_type":          raw.get("offer_type"),
        "discount_percentage": _safe_float(raw.get("discount_percentage"), 0, 100),
        "coupon_code":         raw.get("coupon_code") or None,
        "expiry_date":         _parse_date(raw.get("end_date")),
        "offer_value":         raw.get("description"),
        "website":             raw.get("url") or None,
        "summary":             raw.get("title") or raw.get("description") or f"{brand['name']} promotion",
        "key_highlights":      json.dumps([h for h in highlights if h]),
        "is_active":           is_sale,
        "source":              "ai",
        # ── metadata (not stored in DB, used for cache & logging) ─────────────
        "_is_sale":            is_sale,
        "_confidence":         _safe_float(raw.get("confidence"), 0.0, 1.0),
        "_url":                raw.get("url"),
    }


def parse_response(text: str, brand: dict) -> list[dict]:
    """
    Parse raw LLM response text → list of normalized DB-ready offer dicts.
    Returns empty list if parsing fails.
    """
    parsed = _extract_json(text)
    if parsed is None:
        logger.error(
            "JSON extraction failed for brand=%r. Raw response (first 500 chars): %r",
            brand.get("name"), text[:500] if text else "<empty>",
        )
        return []
    if "offers" not in parsed:
        logger.error(
            "Parsed JSON missing 'offers' key for brand=%r. Keys found: %s. Raw: %r",
            brand.get("name"), list(parsed.keys()), text[:500],
        )
        return []
    items = [item for item in parsed["offers"] if isinstance(item, dict)]
    if not items:
        logger.warning("'offers' array is empty for brand=%r", brand.get("name"))
    return [_normalize(item, brand) for item in items]
