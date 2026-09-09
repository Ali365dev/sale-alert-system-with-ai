#!/usr/bin/env python3
"""Playwright Chromium probe for https://www.sokamal.com/."""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import BASE_URL, MAX_PAGES, REQUEST_TIMEOUT_SECONDS, USER_AGENT
from crawl import crawl_and_analyze
from report import emit


def main() -> int:
    started = time.perf_counter()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        return emit(
            {
                "scraper": "playwright",
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
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            page = browser.new_page(user_agent=USER_AGENT)

            def fetch_html(url: str) -> tuple[int, str, str]:
                response = page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
                page.wait_for_timeout(2500)
                status = response.status if response is not None else 200
                return status, page.content(), page.url

            result = crawl_and_analyze(
                "playwright",
                fetch_html,
                max_pages=min(MAX_PAGES, 5),
                notes="Browser-rendered DOM via Playwright Chromium",
            )
            browser.close()
        return emit(result)
    except Exception as extra:
        return emit(
            {
                "scraper": "playwright",
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
