"""
Shared utility functions for the research module.
"""
import json
import re
from datetime import datetime
from typing import Optional


def clean_llm_json(text: str) -> Optional[str]:
    """
    Strip markdown fences and surrounding prose from an LLM response,
    leaving only the raw JSON string. Returns None if nothing parseable found.
    """
    if not text:
        return None

    text = text.strip()

    # Remove ```json ... ``` or ``` ... ``` fences anywhere in the text
    text = re.sub(r"```(?:json)?", "", text).strip()

    # Strategy 1: entire response is valid JSON
    try:
        json.loads(text)
        return text
    except json.JSONDecodeError:
        pass

    # Strategy 2: extract the outermost { ... } object
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        candidate = match.group()
        try:
            json.loads(candidate)
            return candidate
        except json.JSONDecodeError:
            pass

    return None


def parse_json_offers(text: str) -> Optional[dict]:
    """
    Parse cleaned LLM text into a dict. Returns the dict or None on failure.
    """
    cleaned = clean_llm_json(text)
    if cleaned is None:
        return None
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


def parse_date(date_str: Optional[str]) -> Optional[datetime]:
    """Parse a YYYY-MM-DD string into a datetime. Returns None on failure."""
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%B %d, %Y"):
        try:
            return datetime.strptime(str(date_str), fmt)
        except (ValueError, TypeError):
            continue
    return None


def safe_float(value, lo: float = 0.0, hi: float = 100.0) -> Optional[float]:
    """Clamp a value to [lo, hi]. Returns None if not numeric."""
    try:
        v = float(value)
        return max(lo, min(hi, v))
    except (TypeError, ValueError):
        return None


def build_key_highlights(offer) -> list[str]:
    """
    Build the key_highlights list from a ResearchOffer.
    Includes boolean flags, dates, confidence, and source URL.
    """
    highlights: list[str] = []

    if offer.description:
        highlights.append(offer.description)
    if offer.free_shipping:
        highlights.append("Free shipping available")
    if offer.student_discount:
        highlights.append("Student discount available")
    if offer.member_only:
        highlights.append("Members only offer")
    if offer.start_date:
        highlights.append(f"Start date: {offer.start_date}")
    if offer.confidence is not None:
        highlights.append(f"AI confidence: {offer.confidence:.0%}")
    if offer.url:
        highlights.append(f"Source: {offer.url}")

    return highlights


def separator(label: str = "", width: int = 50) -> str:
    if label:
        pad = max(0, width - len(label) - 2)
        left = pad // 2
        right = pad - left
        return f"{'-' * left} {label} {'-' * right}"
    return "-" * width
