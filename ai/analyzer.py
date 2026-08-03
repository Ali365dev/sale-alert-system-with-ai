"""
Sends email content to AI and parses a structured JSON offer record.
Uses Gemini (primary) with automatic Groq fallback on rate-limit/quota errors.

Returned dict schema
--------------------
{
    "brand": str | null,
    "company": str | null,
    "category": str | null,
    "subcategory": str | null,
    "offer_type": str | null,
    "discount_percentage": float | null,
    "coupon_code": str | null,
    "expiry_date": str | null,        # "YYYY-MM-DD" or null
    "offer_value": str | null,
    "summary": str,
    "key_highlights": list[str],
}
"""
import json
import re
from datetime import datetime, timezone
from typing import Any, Optional

from config import logger
from ai._llm import call_llm
from database.models import Offer
from services.settings_service import get_prompt

PROMPT_KEY = "email_analysis"

_PROMPT_TEMPLATE = """\
You are a JSON-only extraction engine.  Analyse the email below and return a
single valid JSON object — no markdown fences, no prose — matching this schema:

{{
  "brand": "<brand name or null>",
  "company": "<company name or null>",
  "category": "<top-level product/service category, e.g. Fashion, Electronics, Food & Dining>",
  "subcategory": "<specific subcategory, e.g. Men's Clothing, Smartphones, Pizza>",
  "offer_type": "<Discount | BOGO | Free Shipping | Flash Sale | Bundle | Loyalty | Other>",
  "discount_percentage": <number 0-100 or null>,
  "coupon_code": "<code or null>",
  "expiry_date": "<YYYY-MM-DD or null>",
  "offer_value": "<monetary or descriptive value or null>",
  "website_url": "<direct URL to the offer or brand website, or null>",
  "summary": "<one-sentence summary>",
  "key_highlights": ["<highlight 1>", "<highlight 2>", "..."]
}}

Rules:
- brand/company: if not explicitly stated in the subject or body, infer it from the sender's display name or email domain below (e.g. sender "Fossil <fossil@email.fossil.com>" means brand="Fossil") — only fall back to null if the sender is a generic platform (e.g. noreply@mailchimp.com) with no brand identity of its own.
- category: use a broad top-level category (e.g. Fashion, Electronics, Travel, Food & Dining).
- subcategory: use a specific sub-type within the category (e.g. Men's Clothing, Laptops, Hotels).
- discount_percentage: extract the largest numeric discount found; null if none.
- expiry_date: infer year if missing (today is {today}).
- website_url: extract any "Shop Now", "View Offer", or call-to-action link from the email; null if none.
- Return ONLY the JSON object.

--- EMAIL START ---
Sender: {sender}
Subject: {subject}

{body}
--- EMAIL END ---
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


def _safe_float(value: Any, low: float = 0, high: float = 100) -> Optional[float]:
    try:
        v = float(value)
        return max(low, min(high, v))
    except (TypeError, ValueError):
        return None


def analyze_email(subject: str, body: str, sender: str = "") -> Optional[dict]:
    """
    Call AI to extract offer data from a single email.
    Tries Gemini once; on any failure immediately falls back to Groq.
    Returns the parsed dict or None on failure.
    """
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    truncated_body = body[:6000] if body else "(empty body)"
    template = get_prompt(PROMPT_KEY, default=_PROMPT_TEMPLATE)
    prompt = template.format(
        today=today, subject=subject, body=truncated_body, sender=sender or "(unknown)"
    )

    t_start = datetime.now(timezone.utc)
    raw = call_llm(prompt)
    elapsed = (datetime.now(timezone.utc) - t_start).total_seconds()

    if raw is None:
        logger.error("No response from AI for subject=%r (%.2fs)", subject[:60], elapsed)
        return None

    data = _extract_json(raw)
    if data is None:
        logger.error("Could not parse JSON from AI response for subject=%r (%.2fs)", subject[:60], elapsed)
        return None

    data["discount_percentage"] = _safe_float(data.get("discount_percentage"), 0, 100)
    if not isinstance(data.get("key_highlights"), list):
        data["key_highlights"] = []

    logger.info(
        "AI analysis complete in %.2fs — brand=%r category=%r subcategory=%r",
        elapsed, data.get("brand"), data.get("category"), data.get("subcategory"),
    )
    return data


def _parse_expiry(date_str) -> Optional[datetime]:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%B %d, %Y"):
        try:
            return datetime.strptime(date_str, fmt)
        except (ValueError, TypeError):
            continue
    return None


def build_offer(email_id: int, result: dict) -> Offer:
    """Turn an analyze_email() result dict into an unsaved Offer row."""
    return Offer(
        email_id=email_id,
        brand=result.get("brand"),
        company=result.get("company"),
        category=result.get("category"),
        subcategory=result.get("subcategory"),
        offer_type=result.get("offer_type"),
        discount_percentage=result.get("discount_percentage"),
        coupon_code=result.get("coupon_code"),
        expiry_date=_parse_expiry(result.get("expiry_date")),
        offer_value=result.get("offer_value"),
        website=result.get("website_url") or None,
        summary=result.get("summary"),
        key_highlights=json.dumps(result.get("key_highlights", [])),
        is_active=True,
        source="email",
    )
