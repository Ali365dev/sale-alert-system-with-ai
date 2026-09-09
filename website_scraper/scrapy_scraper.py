#!/usr/bin/env python3
"""Minimal Scrapy HTTP crawl of https://www.sokamal.com/. Not a sale-detection engine."""
from __future__ import annotations

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import BASE_URL, MAX_PAGES, REQUEST_DELAY_SECONDS, USER_AGENT
from crawl import assemble_result
from extractors.html_page import extract_links, is_product_url, prioritize_urls
from report import emit


def main() -> int:
    started = time.perf_counter()
    try:
        import scrapy
        from scrapy.crawler import CrawlerProcess
    except ImportError as exc:
        return emit(
            {
                "scraper": "scrapy",
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

    pages: list[dict] = []
    errors: list[str] = []

    class SoKamalSpider(scrapy.Spider):
        name = "sokamal_lab"
        start_urls = [BASE_URL]
        custom_settings = {
            "USER_AGENT": USER_AGENT,
            "ROBOTSTXT_OBEY": True,
            "DOWNLOAD_DELAY": REQUEST_DELAY_SECONDS,
            "CONCURRENT_REQUESTS": 4,
            "LOG_LEVEL": "ERROR",
            "CLOSESPIDER_PAGECOUNT": MAX_PAGES,
        }

        def parse(self, response):
            if len(pages) >= MAX_PAGES:
                return
            pages.append({"url": response.url, "html": response.text, "status": response.status})
            links = extract_links(response.text, response.url)
            follow = prioritize_urls(links, limit=MAX_PAGES * 2)
            products = [u for u in links if is_product_url(u)][:2]
            for url in products + follow:
                if len(pages) >= MAX_PAGES:
                    break
                yield response.follow(url, callback=self.parse)

    try:
        process = CrawlerProcess(settings={"TELNETCONSOLE_ENABLED": False})
        process.crawl(SoKamalSpider)
        process.start()
        result = assemble_result(
            "scrapy",
            pages,
            errors=errors,
            elapsed=time.perf_counter() - started,
            notes="HTTP crawl only; concurrent requests via Scrapy",
        )
        return emit(result)
    except Exception as extra:
        return emit(
            {
                "scraper": "scrapy",
                "url": BASE_URL,
                "status": "failed",
                "execution_time_seconds": round(time.perf_counter() - started, 2),
                "pages_checked": len(pages),
                "sale_signals": [],
                "products": [],
                "structured_data_found": False,
                "reason": f"{type(extra).__name__}: {extra}",
            }
        )


if __name__ == "__main__":
    raise SystemExit(main())
