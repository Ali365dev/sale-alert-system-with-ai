#!/usr/bin/env python3
"""Scrapling Instagram: HTTP Fetcher first, then StealthyFetcher if needed."""
import re
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from report import emit, is_useful

URL = "https://www.instagram.com/beechtree_pk/"


def _from_page(page):
    html = getattr(page, "html", None) or getattr(page, "body", None) or getattr(page, "text", "") or ""
    if not isinstance(html, str):
        html = str(html)
    name = None
    try:
        title = page.css("title::text").get() if hasattr(page, "css") else None
        og = page.css('meta[property="og:title"]::attr(content)').get() if hasattr(page, "css") else None
        name = og or title
    except Exception:
        pass
    if not name:
        m = re.search(r'<meta property="og:title" content="([^"]+)"', html)
        name = m.group(1) if m else None
    post_urls = list(dict.fromkeys("https://www.instagram.com" + p if p.startswith("/") else p for p in re.findall(r'(https://www\.instagram\.com/(?:p|reel)/[^"\s/]+/?|/p/[^"\s/]+/?)', html)))
    images = re.findall(r'https://[^"\s]+(?:cdninstagram|fbcdn|scontent)[^"\s]+', html)[:20]
    texts = re.findall(r'<meta property="og:description" content="([^"]+)"', html)
    return name, post_urls[:10], texts, images


def main() -> int:
    started = time.perf_counter()
    notes = "method=Fetcher (HTTP/TLS impersonation)"
    try:
        try:
            from scrapling.fetchers import Fetcher
        except ImportError:
            from scrapling import Fetcher
    except ImportError as exc:
        return emit("Scrapling", "Instagram", URL, time.perf_counter() - started, status="FAILED", reason=str(exc))

    try:
        page = Fetcher.get(URL)
        name, post_urls, texts, images = _from_page(page)
        if is_useful(name, post_urls, texts, images):
            return emit("Scrapling", "Instagram", URL, time.perf_counter() - started, status="SUCCESS", profile_name=name, post_urls=post_urls, texts=texts, images=images, notes=notes)

        notes = "Fetcher returned no useful data; retrying with StealthyFetcher (browser)"
        try:
            from scrapling.fetchers import StealthyFetcher
        except ImportError:
            from scrapling import StealthyFetcher
        page = StealthyFetcher.fetch(URL, headless=True, network_idle=True, timeout=60000)
        name, post_urls, texts, images = _from_page(page)
        notes = "method=StealthyFetcher (browser) required"
        elapsed = time.perf_counter() - started
        if not is_useful(name, post_urls, texts, images):
            return emit("Scrapling", "Instagram", URL, elapsed, status="FAILED", reason="Fetcher and StealthyFetcher both returned no useful public posts", notes=notes)
        return emit("Scrapling", "Instagram", URL, elapsed, status="SUCCESS", profile_name=name, post_urls=post_urls, texts=texts, images=images, notes=notes)
    except Exception as exc:
        return emit("Scrapling", "Instagram", URL, time.perf_counter() - started, status="FAILED", reason=f"{type(exc).__name__}: {exc}", notes=notes)


if __name__ == "__main__":
    raise SystemExit(main())
