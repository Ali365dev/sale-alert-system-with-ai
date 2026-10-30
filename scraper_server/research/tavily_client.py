"""
Tavily search client for the research module.
Uses raw HTTP — no tavily-python package required.
"""
import requests

from research.config import (
    TAVILY_API_KEY,
    TAVILY_MAX_RESULTS,
    TAVILY_SEARCH_DEPTH,
    TAVILY_TIMEOUT,
    logger,
)
from research.prompts import build_search_query

_TAVILY_URL = "https://api.tavily.com/search"


class TavilyClient:
    """
    Wraps the Tavily search API.
    One instance per process; stateless between calls.
    """

    def __init__(self) -> None:
        from services.settings_service import get_active_api_key

        self._api_key = get_active_api_key("tavily") or TAVILY_API_KEY
        if not self._api_key:
            raise RuntimeError(
                "Tavily is not configured — add a key in Settings or set TAVILY_API_KEY."
            )

    def search(self, brand_name: str) -> dict:
        """
        Run a Tavily search for brand offers.

        Returns the raw Tavily response dict on success.
        Raises on network or HTTP error — caller decides whether to skip or retry.
        """
        query = build_search_query(brand_name)
        logger.debug("Tavily query: %s", query)

        payload = {
            "api_key": self._api_key,
            "query": query,
            "search_depth": TAVILY_SEARCH_DEPTH,
            "max_results": TAVILY_MAX_RESULTS,
            "include_answer": False,
            "include_raw_content": False,
        }

        resp = requests.post(
            _TAVILY_URL,
            json=payload,
            timeout=TAVILY_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()

        result_count = len(data.get("results", []))
        logger.info("Tavily returned %d result(s) for %r.", result_count, brand_name)
        return data
