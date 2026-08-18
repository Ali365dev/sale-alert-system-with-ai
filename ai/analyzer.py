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
    "expiry_date": str | null,            # "YYYY-MM-DD" — only for an EXPLICIT calendar date, else null
    "expiry_relative_phrase": str | null, # raw wording like "tomorrow"/"this weekend", else null
    "expiry_date_basis": "explicit" | "relative" | "none",
    "expiry_date_confidence": float | null,  # 0-1
    "offer_value": str | null,
    "summary": str,
    "key_highlights": list[str],
}

Expiry dates are never computed by the AI itself for relative wording — see
ai/expiry_resolver.py, which turns expiry_relative_phrase into a concrete date
anchored to the email's received_at (not to whenever this code runs).
"""
import json
import re
from datetime import datetime, timezone
from typing import Any, Optional

from config import logger
from ai._llm import call_llm
from ai.expiry_resolver import resolve_relative_expiry
from database.models import Offer
from database.offer_retention import compute_delete_after, utcnow
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
  "expiry_relative_phrase": "<raw wording or null>",
  "expiry_date_basis": "<explicit | relative | none>",
  "expiry_date_confidence": <number 0-1>,
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
- Expiration — read carefully, this is extracted in two different ways depending on how the email states it. Get this right, it drives when the offer is auto-deleted from the database:
  - If the email states an EXPLICIT calendar date or day+month (e.g. "ends August 20", "valid until 12/25"): set expiry_date to that date in YYYY-MM-DD (infer the year if missing — this email was received on {today}, use that to pick the correct year), expiry_relative_phrase = null, expiry_date_basis = "explicit".
  - If the email uses RELATIVE wording instead of a calendar date (e.g. "today only", "tonight", "tomorrow", "ending tomorrow", "this weekend", "next Sunday", "ends Friday", "valid for 3 days"): expiry_date MUST be null, expiry_relative_phrase = the exact relative wording copied verbatim, expiry_date_basis = "relative". This case is easy to get wrong — do NOT calculate the actual date yourself and do NOT put a computed date into expiry_date; a different, more reliable system computes it afterwards from expiry_relative_phrase. Your only job for this case is copying the phrase and setting basis = "relative".
    Example: email received {today}, text says "Flat 14% off ending tomorrow" → {{"expiry_date": null, "expiry_relative_phrase": "ending tomorrow", "expiry_date_basis": "relative", "expiry_date_confidence": 0.9}}
  - If there is no expiration mentioned, or it's too vague to act on (e.g. "limited time offer", "while supplies last", "this summer"): expiry_date = null, expiry_relative_phrase = null, expiry_date_basis = "none".
  - Never invent or guess a date that isn't actually supported by the email text.
  - expiry_date_confidence: your confidence (0-1) in the expiry information above — 1.0 for an unambiguous explicit date, lower for vague/ambiguous wording, 0 when expiry_date_basis is "none".
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


def analyze_email(subject: str, body: str, sender: str = "", received_at: Optional[datetime] = None) -> Optional[dict]:
    """
    Call AI to extract offer data from a single email.
    Tries Gemini once; on any failure immediately falls back to Groq.

    received_at is the email's own received date/time (Email.received_date) —
    used as the reference "today" for the AI's year-inference on explicit
    dates. It is NOT used for relative-phrase math; that happens afterwards in
    build_offer() via ai.expiry_resolver, anchored to the same received_at, so
    it stays correct however long the email sat unprocessed.

    Returns the parsed dict or None on failure.
    """
    reference_date = received_at or datetime.now(timezone.utc)
    today = reference_date.strftime("%Y-%m-%d")
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
    if data.get("expiry_date_basis") not in ("explicit", "relative", "none"):
        data["expiry_date_basis"] = "none"
    data["expiry_date_confidence"] = _safe_float(data.get("expiry_date_confidence"), 0, 1)

    logger.info(
        "AI analysis complete in %.2fs — brand=%r category=%r subcategory=%r expiry_basis=%r",
        elapsed, data.get("brand"), data.get("category"), data.get("subcategory"), data.get("expiry_date_basis"),
    )
    return data


def _parse_explicit_expiry(date_str) -> Optional[datetime]:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%B %d, %Y"):
        try:
            return datetime.strptime(date_str, fmt)
        except (ValueError, TypeError):
            continue
    return None


def _resolve_expiry(result: dict, received_at: datetime) -> tuple[Optional[datetime], str]:
    """Returns (expiry_date, basis). basis reflects whichever path actually
    produced the date, NOT the model's self-reported expiry_date_basis — in
    practice that field isn't reliable (e.g. the model will sometimes compute
    the date itself for relative wording, correctly, but still mark basis
    "none"). Stored basis staying consistent with the stored date matters
    more than parroting the model's own label.

    Tries the deterministic phrase resolver first whenever a phrase is
    present — the one path that's actually unreliable coming straight from
    the model — then falls back to whatever is parseable out of expiry_date.
    Never invents a date that doesn't parse from real model output either way."""
    phrase = result.get("expiry_relative_phrase")
    if phrase:
        resolved = resolve_relative_expiry(phrase, received_at)
        if resolved is not None:
            return resolved, "relative"
    explicit = _parse_explicit_expiry(result.get("expiry_date"))
    if explicit is not None:
        return explicit, "explicit"
    return None, "none"


def build_offer(email_id: int, result: dict, received_at: Optional[datetime] = None, subject: Optional[str] = None) -> Offer:
    """Turn an analyze_email() result dict into an unsaved Offer row.

    received_at should be the email's Email.received_date (falls back to "now"
    only if unavailable, e.g. a malformed/missing Date header) — it anchors
    both relative-expiry resolution and the no-expiry retention window, per
    database.offer_retention.

    subject should be the email's subject line, verbatim — it becomes the
    offer title as-is (never AI-generated, never sanitized). Offers with no
    source email (source="ai") simply have no title.
    """
    received_at = received_at or utcnow()
    expiry_date, expiry_basis = _resolve_expiry(result, received_at)
    # offers.title is VARCHAR(500) — Postgres enforces that at insert time
    # (unlike SQLite), so an unusually long subject can't crash offer
    # creation. Real email subjects are essentially never this long; this is
    # a safety net, not expected sanitization.
    title = subject[:500] if subject else None

    return Offer(
        email_id=email_id,
        title=title,
        brand=result.get("brand"),
        company=result.get("company"),
        category=result.get("category"),
        subcategory=result.get("subcategory"),
        offer_type=result.get("offer_type"),
        discount_percentage=result.get("discount_percentage"),
        coupon_code=result.get("coupon_code"),
        expiry_date=expiry_date,
        expiry_date_basis=expiry_basis,
        expiry_date_confidence=result.get("expiry_date_confidence"),
        delete_after=compute_delete_after(expiry_date, received_at),
        offer_value=result.get("offer_value"),
        website=result.get("website_url") or None,
        summary=result.get("summary"),
        key_highlights=json.dumps(result.get("key_highlights", [])),
        is_active=True,
        source="email",
    )
