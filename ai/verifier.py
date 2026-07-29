"""
Verifies whether an offer is genuine using AI.
Uses Gemini (primary) with automatic Groq fallback on rate-limit/quota errors.

Returned dict schema
--------------------
{
    "is_valid_offer": bool,
    "confidence": int,          # 0-100
    "reason": str,
    "status": "verified" | "suspicious" | "invalid"
}
"""
import json
import re
from typing import Optional

from config import logger
from ai._llm import call_llm

_VERIFY_PROMPT = """\
You are an offer verification engine. Analyse the promotional offer details below and
return a single valid JSON object — no markdown fences, no prose — matching this schema:

{{
  "is_valid_offer": <true or false>,
  "confidence": <integer 0-100>,
  "reason": "<one to two sentence explanation>"
}}

Evaluation criteria:
1. Is this a genuine promotional offer (not spam or phishing)?
2. Is the discount clearly defined and realistic?
3. Are expiry dates present and valid?
4. Is there enough information for a user to redeem the offer?
5. Is the offer from a recognisable brand or company?

Confidence guide:
- 90-100: Clearly legitimate, all details present and consistent.
- 70-89: Likely legitimate, minor missing details.
- 50-69: Uncertain — some suspicious elements or missing key info.
- 30-49: Likely spam or misleading.
- 0-29: Almost certainly spam, phishing, or invalid.

--- OFFER DETAILS ---
Brand: {brand}
Company: {company}
Category: {category}
Subcategory: {subcategory}
Offer Type: {offer_type}
Discount %: {discount_percentage}
Coupon Code: {coupon_code}
Expiry Date: {expiry_date}
Offer Value: {offer_value}
Summary: {summary}
Key Highlights: {key_highlights}
--- END OFFER ---
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


def verify_offer(offer_data: dict, retries: int = 3) -> Optional[dict]:
    """
    Call AI to verify whether an offer is genuine.
    Tries Gemini first; falls back to Groq on rate-limit/quota errors.

    Args:
        offer_data: dict with offer fields (brand, company, category, subcategory,
                    offer_type, discount_percentage, coupon_code, expiry_date,
                    offer_value, summary, key_highlights)

    Returns:
        dict with is_valid_offer, confidence, reason, status — or None on failure.
    """
    highlights = offer_data.get("key_highlights") or []
    if isinstance(highlights, str):
        try:
            highlights = json.loads(highlights)
        except (json.JSONDecodeError, TypeError):
            highlights = [highlights]

    prompt = _VERIFY_PROMPT.format(
        brand=offer_data.get("brand") or "Unknown",
        company=offer_data.get("company") or "Unknown",
        category=offer_data.get("category") or "Unknown",
        subcategory=offer_data.get("subcategory") or "Unknown",
        offer_type=offer_data.get("offer_type") or "Unknown",
        discount_percentage=offer_data.get("discount_percentage") or "Not specified",
        coupon_code=offer_data.get("coupon_code") or "None",
        expiry_date=offer_data.get("expiry_date") or "Not specified",
        offer_value=offer_data.get("offer_value") or "Not specified",
        summary=offer_data.get("summary") or "Not specified",
        key_highlights=", ".join(highlights) if highlights else "None",
    )

    for attempt in range(1, retries + 1):
        raw = call_llm(prompt, retries=1)
        if raw is None:
            logger.warning("Verify attempt %d: no response from AI.", attempt)
            continue

        data = _extract_json(raw)
        if data is None:
            logger.warning("Verify attempt %d: could not parse JSON.", attempt)
            continue

        is_valid = bool(data.get("is_valid_offer", False))
        try:
            confidence = max(0, min(100, int(data.get("confidence", 50))))
        except (TypeError, ValueError):
            confidence = 50

        reason = data.get("reason", "No reason provided.")

        if is_valid and confidence >= 70:
            status = "verified"
        elif confidence >= 40:
            status = "suspicious"
        else:
            status = "invalid"

        result = {
            "is_valid_offer": is_valid,
            "confidence": confidence,
            "reason": reason,
            "status": status,
        }
        logger.info("Offer verification: status=%s confidence=%d", status, confidence)
        return result

    logger.error("All %d verification attempts failed.", retries)
    return None


_EMAIL_VERIFY_PROMPT = """\
You are an email legitimacy classifier. Read the email below and return a single
valid JSON object — no markdown fences, no prose — matching this schema:

{{
  "status": "<legitimate | suspicious | spam>",
  "confidence": <integer 0-100>,
  "reason": "<one to two sentence explanation>"
}}

Classification guide:
- legitimate: genuine promotional email from a real brand/company.
- suspicious: possibly real but contains misleading claims, urgency tactics, or missing key details.
- spam: phishing, scam, irrelevant bulk mail, or no real offer.

Confidence guide:
- 90-100: Very confident in the classification.
- 70-89: Fairly confident, minor ambiguity.
- 50-69: Uncertain — mixed signals.
- 0-49: Low confidence.

--- EMAIL START ---
From: {sender}
Subject: {subject}

{body}
--- EMAIL END ---
"""


def verify_email_content(sender: str, subject: str, body: str) -> Optional[dict]:
    """
    Call AI to classify a raw email as legitimate, suspicious, or spam.

    Returns:
        dict with status ("legitimate"|"suspicious"|"spam"), confidence (0-100),
        reason — or None on failure.
    """
    prompt = _EMAIL_VERIFY_PROMPT.format(
        sender=sender or "Unknown",
        subject=subject or "(no subject)",
        body=(body or "")[:6000],
    )

    raw = call_llm(prompt)
    if raw is None:
        logger.error("No AI response for email verification (subject=%r)", subject[:60])
        return None

    data = _extract_json(raw)
    if data is None:
        logger.error("Could not parse JSON from email verification response.")
        return None

    status = data.get("status", "suspicious")
    if status not in ("legitimate", "suspicious", "spam"):
        status = "suspicious"

    try:
        confidence = max(0, min(100, int(data.get("confidence", 50))))
    except (TypeError, ValueError):
        confidence = 50

    result = {
        "status": status,
        "confidence": confidence,
        "reason": data.get("reason", "No reason provided."),
    }
    logger.info("Email verification: status=%s confidence=%d subject=%r",
                status, confidence, subject[:60])
    return result
