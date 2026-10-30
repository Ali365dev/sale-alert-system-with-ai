#!/usr/bin/env python3
"""Minimal Scrapy spider — HTTP crawl only, not an Instagram-specific extractor."""
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from report import emit, is_useful

URL = "https://www.instagram.com/beechtree_pk/"


def main() -> int:
    started = time.perf_counter()
    try:
        import scrapy
        from scrapy.crawler import CrawlerProcess
    except ImportError as exc:
        return emit("Scrapy", "Instagram", URL, time.perf_counter() - started, status="FAILED", reason=str(exc))

    collected = {"name": None, "post_urls": [], "texts": [], "images": []}

    class InstagramProbeSpider(scrapy.Spider):
        name = "instagram_probe"
        start_urls = [URL]
        custom_settings = {
            "USER_AGENT": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "LOG_ENABLED": False,
            "ROBOTSTXT_OBEY": False,
            "DOWNLOAD_TIMEOUT": 30,
        }

        def parse(self, response):
            collected["name"] = response.css('meta[property="og:title"]::attr(content)').get() or response.css("title::text").get()
            desc = response.css('meta[property="og:description"]::attr(content)').get()
            if desc:
                collected["texts"].append(desc)
            for href in response.css("a::attr(href)").getall():
                if "/p/" in href or "/reel/" in href:
                    if href.startswith("/"):
                        href = response.urljoin(href)
                    if href not in collected["post_urls"]:
                        collected["post_urls"].append(href)
            for src in response.css("img::attr(src)").getall():
                if "cdninstagram" in src or "scontent" in src or "fbcdn" in src:
                    collected["images"].append(src)

    try:
        process = CrawlerProcess(settings={"LOG_ENABLED": False})
        process.crawl(InstagramProbeSpider)
        process.start()
    except Exception as exc:
        return emit("Scrapy", "Instagram", URL, time.perf_counter() - started, status="FAILED", reason=f"{type(exc).__name__}: {exc}", notes="Scrapy is an HTTP crawler, not an Instagram API.")

    elapsed = time.perf_counter() - started
    notes = "Scrapy only does HTTP crawling; it has no Instagram-specific capability."
    if not is_useful(collected["name"], collected["post_urls"], collected["texts"], collected["images"]):
        return emit("Scrapy", "Instagram", URL, elapsed, status="FAILED", reason=f"Static HTML title={collected['name']!r}; no posts extracted", notes=notes)
    return emit("Scrapy", "Instagram", URL, elapsed, status="SUCCESS", profile_name=collected["name"], post_urls=collected["post_urls"], texts=collected["texts"], images=collected["images"], notes=notes)


if __name__ == "__main__":
    raise SystemExit(main())
