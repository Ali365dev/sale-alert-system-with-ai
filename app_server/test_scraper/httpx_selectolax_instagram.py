#!/usr/bin/env python3
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from report import emit, is_useful

URL = "https://www.instagram.com/beechtree_pk/"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)


def main() -> int:
    started = time.perf_counter()
    try:
        import httpx
        from selectolax.parser import HTMLParser
    except ImportError as exc:
        return emit("httpx + selectolax", "Instagram", URL, time.perf_counter() - started, status="FAILED", reason=str(exc))

    try:
        with httpx.Client(follow_redirects=True, timeout=30.0, headers={"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"}) as client:
            response = client.get(URL)
        html = HTMLParser(response.text)
        og = html.css_first('meta[property="og:title"]')
        title = html.css_first("title")
        name = (og.attributes.get("content") if og else None) or (title.text() if title else None)
        post_urls = []
        for node in html.css("a[href]"):
            href = node.attributes.get("href") or ""
            if "/p/" in href or "/reel/" in href:
                if href.startswith("/"):
                    href = "https://www.instagram.com" + href
                if href not in post_urls:
                    post_urls.append(href)
        texts = []
        desc = html.css_first('meta[property="og:description"]')
        if desc and desc.attributes.get("content"):
            texts.append(desc.attributes["content"])
        images = []
        for node in html.css("img[src]"):
            src = node.attributes.get("src") or ""
            if "cdninstagram" in src or "fbcdn" in src or "scontent" in src:
                images.append(src)
        elapsed = time.perf_counter() - started
        if response.status_code >= 400:
            return emit("httpx + selectolax", "Instagram", URL, elapsed, status="FAILED", reason=f"HTTP {response.status_code}")
        if not is_useful(name, post_urls, texts, images):
            return emit(
                "httpx + selectolax", "Instagram", URL, elapsed, status="FAILED",
                reason=f"HTTP {response.status_code}; title={name!r}; no posts/images in static HTML (likely login wall)",
            )
        return emit("httpx + selectolax", "Instagram", URL, elapsed, status="SUCCESS", profile_name=name, post_urls=post_urls, texts=texts, images=images)
    except Exception as exc:
        return emit("httpx + selectolax", "Instagram", URL, time.perf_counter() - started, status="FAILED", reason=f"{type(exc).__name__}: {exc}")


if __name__ == "__main__":
    raise SystemExit(main())
