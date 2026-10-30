"""
DuckDuckGo-based search provider for brand promotion discovery.
Returns lightweight search result snippets — no HTML download.
"""
import time
from datetime import datetime, timezone
from typing import Optional

from config import BRAND_SEARCH_RESULTS, logger

# Type alias
SearchResult = dict  # {title: str, snippet: str, url: str}


def _build_queries(brand_name: str) -> list[str]:
    month_year = datetime.now(timezone.utc).strftime("%B %Y")
    return [
        f"{brand_name} sale {month_year}",
        f"{brand_name} discount coupon code",
        f"{brand_name} promotions offers today",
    ]


def search_brand(brand_name: str, max_per_query: Optional[int] = None) -> list[SearchResult]:
    """
    Run targeted search queries for a brand's current promotions.

    Args:
        brand_name:     Brand to search for.
        max_per_query:  Max results per query (default: BRAND_SEARCH_RESULTS).

    Returns:
        Deduplicated list of {title, snippet, url}.
        Logs search duration and result count.
    """
    if max_per_query is None:
        max_per_query = BRAND_SEARCH_RESULTS

    try:
        from ddgs import DDGS
    except ImportError:
        logger.error("ddgs not installed — run: pip install ddgs")
        return []

    queries     = _build_queries(brand_name)
    seen_urls:  set[str]          = set()
    results:    list[SearchResult] = []

    t_start = time.monotonic()

    try:
        with DDGS() as ddgs:
            for query in queries:
                try:
                    hits = ddgs.text(query, max_results=max_per_query) or []
                    for h in hits:
                        url = h.get("href", "")
                        if url and url not in seen_urls:
                            seen_urls.add(url)
                            results.append({
                                "title":   (h.get("title") or "").strip(),
                                "snippet": (h.get("body")  or "").strip(),
                                "url":     url,
                            })
                except Exception as exc:
                    logger.warning("Search query %r failed: %s", query, exc)
    except Exception as exc:
        logger.error("DDGS session failed for brand=%r: %s", brand_name, exc)

    elapsed = time.monotonic() - t_start
    logger.info(
        "Search done — brand=%r queries=%d results=%d duration=%.2fs",
        brand_name, len(queries), len(results), elapsed,
    )
    return results
