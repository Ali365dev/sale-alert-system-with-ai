#!/usr/bin/env python3
"""Camoufox browser probe for https://www.sokamal.com/."""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import BASE_URL, MAX_PAGES, REQUEST_TIMEOUT_SECONDS
from crawl import crawl_and_analyze
from report import emit


def main() -> int:
    started = time.perf_counter()
    try:
        from camoufox.sync_api import Camoufox
    except ImportError as exc:
        return emit(
            {
                "scraper": "camoufox",
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
        timeout_ms = int(REQUEST_TIMEOUT_SECONDS * 1000)
        with Camoufox(headless=True, os="macos") as browser:
            page = browser.new_page()

            def fetch_html(url: str) -> tuple[int, str, str]:
                response = page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                page.wait_for_timeout(2500)
                status = response.status if response is not None else 200
                return status, page.content(), page.url

            result = crawl_and_analyze(
                "camoufox",
                fetch_html,
                max_pages=min(MAX_PAGES, 5),
                notes="Browser-rendered DOM via Camoufox",
            )
        return emit(result)
    except Exception as extra:
        return emit(
            {
                "scraper": "camoufox",
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
