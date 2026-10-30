#!/usr/bin/env python3
"""Lightweight HTTP baseline for https://www.sokamal.com/."""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import BASE_URL, REQUEST_TIMEOUT_SECONDS, USER_AGENT
from crawl import crawl_and_analyze
from report import emit


def fetch_html(url: str) -> tuple[int, str, str]:
    import httpx

    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9"}
    with httpx.Client(follow_redirects=True, timeout=REQUEST_TIMEOUT_SECONDS, headers=headers) as client:
        response = client.get(url)
    return response.status_code, response.text, str(response.url)


def main() -> int:
    started = time.perf_counter()
    try:
        import httpx  # noqa: F401
        from selectolax.parser import HTMLParser  # noqa: F401
    except ImportError as exc:
        return emit(
            {
                "scraper": "httpx_selectolax",
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
        result = crawl_and_analyze("httpx_selectolax", fetch_html)
        return emit(result)
    except Exception as extra:
        return emit(
            {
                "scraper": "httpx_selectolax",
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
