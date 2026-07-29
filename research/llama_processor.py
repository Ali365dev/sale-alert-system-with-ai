"""
Local Llama processor for the research module.
Sends the full Tavily response to Ollama and parses structured JSON offers.
"""
import requests

from research.config import (
    OLLAMA_BASE_URL,
    OLLAMA_MODEL,
    OLLAMA_TIMEOUT,
    logger,
)
from research.models import ResearchOffer
from research.prompts import build_llm_prompt
from research.utils import parse_json_offers, safe_float

_OLLAMA_URL = f"{OLLAMA_BASE_URL.rstrip('/')}/api/generate"


class LlamaProcessor:
    """
    Sends prompts to a local Ollama model and parses the JSON response
    into a list of ResearchOffer objects.
    """

    def __init__(self) -> None:
        logger.debug("LlamaProcessor using model %r at %s", OLLAMA_MODEL, _OLLAMA_URL)

    # ── Low-level call ─────────────────────────────────────────────────────────

    def _call_ollama(self, prompt: str) -> str:
        """
        POST to Ollama and return raw response text.
        Raises on network or HTTP errors.
        """
        payload = {
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.1},
        }
        resp = requests.post(_OLLAMA_URL, json=payload, timeout=OLLAMA_TIMEOUT)

        # 4xx errors are not transient — surface them immediately
        if resp.status_code != 200:
            logger.error(
                "Ollama returned HTTP %d: %s", resp.status_code, resp.text[:300]
            )
            resp.raise_for_status()

        return resp.json().get("response", "")

    # ── JSON parsing ───────────────────────────────────────────────────────────

    def _parse_offers(self, raw_text: str, brand_name: str) -> list[ResearchOffer]:
        """Parse raw LLM text into validated ResearchOffer objects."""
        data = parse_json_offers(raw_text)
        if data is None:
            return []

        raw_offers = data.get("offers", [])
        if not isinstance(raw_offers, list):
            logger.warning("LLM response 'offers' is not a list for brand=%r", brand_name)
            return []

        parsed: list[ResearchOffer] = []
        for item in raw_offers:
            if not isinstance(item, dict):
                continue
            try:
                offer = ResearchOffer(
                    brand=item.get("brand") or brand_name,
                    title=str(item.get("title") or "").strip() or f"{brand_name} Promotion",
                    description=str(item.get("description") or "").strip(),
                    discount_percentage=safe_float(item.get("discount_percentage"), 0, 100),
                    coupon_code=str(item["coupon_code"]).strip() if item.get("coupon_code") else None,
                    offer_type=str(item.get("offer_type") or "no_sale").lower().strip(),
                    is_sale=bool(item.get("is_sale", False)),
                    free_shipping=bool(item.get("free_shipping", False)),
                    student_discount=bool(item.get("student_discount", False)),
                    member_only=bool(item.get("member_only", False)),
                    start_date=str(item["start_date"]) if item.get("start_date") else None,
                    end_date=str(item["end_date"]) if item.get("end_date") else None,
                    url=str(item["url"]).strip() if item.get("url") else None,
                    confidence=safe_float(item.get("confidence"), 0.0, 1.0) or 0.0,
                    source="research",
                )
                parsed.append(offer)
            except Exception as exc:
                logger.warning("Skipping malformed offer item for brand=%r: %s", brand_name, exc)

        return parsed

    # ── Public entry point ─────────────────────────────────────────────────────

    def process(self, brand_name: str, tavily_response: dict) -> list[ResearchOffer]:
        """
        Build the prompt, call Ollama, parse the result.
        Retries once if the first response cannot be parsed.
        Returns a (possibly empty) list of ResearchOffer objects.
        """
        prompt = build_llm_prompt(brand_name, tavily_response)
        logger.info("Sending Tavily results to Local Llama (%s) …", OLLAMA_MODEL)

        for attempt in range(1, 3):  # up to 2 attempts
            try:
                raw_text = self._call_ollama(prompt)
            except Exception as exc:
                logger.error(
                    "Ollama call failed (attempt %d/2) for brand=%r: %s",
                    attempt, brand_name, exc,
                )
                if attempt == 2:
                    return []
                logger.info("Retrying Ollama …")
                continue

            offers = self._parse_offers(raw_text, brand_name)
            if offers or attempt == 2:
                if not offers:
                    logger.warning(
                        "Could not parse valid JSON from Llama response for brand=%r "
                        "after %d attempt(s). Raw (first 500 chars): %r",
                        brand_name, attempt, raw_text[:500],
                    )
                return offers

            logger.warning(
                "Llama returned unparseable JSON for brand=%r (attempt 1) — retrying …",
                brand_name,
            )

        return []
