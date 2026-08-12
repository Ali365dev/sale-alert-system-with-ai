"""
Identifies the real-world brand behind an email the pipeline couldn't match
to any known brand's sender domain (see services/jobs/discover_brand.py).

Two-step, best-effort:
  1. First-pass LLM call using only sender/subject/body.
  2. If a brand_name came back, an optional web-search confirmation pass
     (reusing ai.search_provider.search_brand) feeds snippets into a second
     LLM call to refine website/logo/socials/confidence. Search failures are
     swallowed — falls back to the first-pass result, mirroring
     ai/brand_fetcher.py's resilience pattern.

Returned dict schema
---------------------
{
    "brand_name": str | null,
    "website": str | null,
    "category": str | null,
    "logo_url": str | null,
    "country": str | null,
    "social_links": {"instagram": str|null, "twitter": str|null, "facebook": str|null, "linkedin": str|null},
    "confidence": float,   # 0.0 - 1.0
    "reasoning": str,
}
"""
import json
import re
from datetime import datetime, timezone
from typing import Optional

from config import logger
from ai._llm import call_llm
from services.settings_service import get_prompt

PROMPT_KEY = "brand_identification"

_PROMPT_TEMPLATE = """\
You are a JSON-only brand-identification engine. Given an email that could
not be automatically matched to a known brand, identify the real-world brand
that sent it and return a single valid JSON object — no markdown fences, no
prose — matching this schema:

{{
  "brand_name": "<best-guess brand/company name, or null if truly unidentifiable>",
  "website": "<official website URL, or null>",
  "category": "<top-level category, e.g. Fashion, Electronics, Travel>",
  "logo_url": "<a URL to the brand's logo if visible in search results, or null>",
  "country": "<country of origin/operation, or null>",
  "social_links": {{"instagram": "<url or null>", "twitter": "<url or null>", "facebook": "<url or null>", "linkedin": "<url or null>"}},
  "confidence": <number 0.0-1.0>,
  "reasoning": "<one or two sentences on how you identified it>"
}}

Rules:
- Use the sender email domain, sender display name, subject, and body content together.
- confidence should reflect how certain you are — a well-known brand name explicit in the sender domain is high confidence (0.85+); an ambiguous generic sender is low (below 0.4).
- If web search results are provided below, prefer their titles/URLs as the authoritative source for the official website.
- Return ONLY the JSON object.

--- EMAIL ---
Sender: {sender}
Subject: {subject}

{body}
--- END EMAIL ---
{search_context}
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


def _normalize(data: dict) -> dict:
    socials = data.get("social_links")
    if not isinstance(socials, dict):
        socials = {}
    return {
        "brand_name": data.get("brand_name") or None,
        "website": data.get("website") or None,
        "category": data.get("category") or None,
        "logo_url": data.get("logo_url") or None,
        "country": data.get("country") or None,
        "social_links": {
            "instagram": socials.get("instagram") or None,
            "twitter": socials.get("twitter") or None,
            "facebook": socials.get("facebook") or None,
            "linkedin": socials.get("linkedin") or None,
        },
        "confidence": _safe_confidence(data.get("confidence")),
        "reasoning": data.get("reasoning") or "",
    }


def _call(subject: str, body: str, sender: str, search_context: str) -> Optional[dict]:
    template = get_prompt(PROMPT_KEY, default=_PROMPT_TEMPLATE)
    prompt = template.format(
        sender=sender or "(unknown)",
        subject=subject or "(no subject)",
        body=(body or "")[:6000] or "(empty body)",
        search_context=search_context,
    )
    raw = call_llm(prompt)
    if raw is None:
        return None
    return _extract_json(raw)


def identify_brand(subject: str, body: str, sender: str) -> Optional[dict]:
    """Best-effort brand identification for an email with no matching known
    brand. Returns the schema dict above, or None if the first-pass LLM call
    itself fails outright."""
    t_start = datetime.now(timezone.utc)

    first_pass = _call(subject, body, sender, search_context="")
    if first_pass is None:
        logger.error("brand_identifier: no/unparseable AI response for subject=%r", (subject or "")[:60])
        return None

    result = _normalize(first_pass)

    if result["brand_name"]:
        try:
            from ai.search_provider import search_brand

            hits = search_brand(result["brand_name"], max_per_query=3)
            if hits:
                snippet_lines = "\n".join(
                    f"- {h.get('title', '')} ({h.get('url', '')}): {h.get('snippet', '')}"
                    for h in hits[:8]
                )
                search_context = f"\n--- WEB SEARCH RESULTS for {result['brand_name']!r} ---\n{snippet_lines}\n"
                refined = _call(subject, body, sender, search_context=search_context)
                if refined is not None:
                    result = _normalize(refined)
        except Exception as exc:
            logger.warning("brand_identifier: search-confirmation pass failed, using first-pass result: %s", exc)

    elapsed = (datetime.now(timezone.utc) - t_start).total_seconds()
    logger.info(
        "brand_identifier: brand_name=%r confidence=%.2f (%.2fs)",
        result["brand_name"], result["confidence"], elapsed,
    )
    return result
