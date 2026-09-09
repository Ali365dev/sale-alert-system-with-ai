#!/usr/bin/env python3
"""Scrapling Fetcher probe for https://www.sokamal.com/."""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import BASE_URL
from crawl import crawl_and_analyze
from report import emit


def fetch_html(url: str) -> tuple[int, str, str]:
    from scrapling.fetchers import Fetcher

    page = Fetcher.get(url) if hasattr(Fetcher, "get") else Fetcher.fetch(url)
    html = getattr(page, "html", None) or getattr(page, "body", None) or getattr(page, "text", "") or ""
    if not isinstance(html, str):
        html = str(html)
    status = getattr(page, "status", None) or getattr(page, "status_code", None) or (200 if html else 0)
    final = str(getattr(page, "url", url) or url)
    return int(status), html, final


def main() -> int:
    started = time.perf_counter()
    try:
        from scrapling.fetchers import Fetcher  # noqa: F401
    except ImportError as exc:
        return emit(
            {
                "scraper": "scrapling",
                "url": BASE_URL,
                "status": "failed",
                "execution_time_seconds": round(time.perf_counter() - started, 2),
                "pages_checked": 0,
                "sale_signals": [],
                "products": [],
                "structured_data_found": False,
                "reason": str(exc),
            }
        )
    try:
        result = crawl_and_analyze(
            "scrapling",
            fetch_html,
            notes="Used Scrapling Fetcher (HTTP). StealthyFetcher was not required if HTML already contained products.",
        )
        html_empty = result["pages_checked"] > 0 and not result["products"] and not result["sale_signals"]
        if html_empty:
            result["notes"] = "JavaScript rendering may be required; Fetcher returned no extractable sale/product fields."
        return emit(result)
    except Exception as extra:
        return emit(
            {
                "scraper": "scrapling",
                "url": BASE_URL,
                "status": "failed",
                "execution_time_seconds": round(time.perf_counter() - started, 2),
                "pages_checked": 0,
                "sale_signals": [],
                "products": [],
                "structured_data_found": False,
                "reason": f"{type(extra).__name__}: {extra}",
            }
        )


if __name__ == "__main__":
    raise SystemExit(main())
