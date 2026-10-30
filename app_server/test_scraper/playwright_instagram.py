#!/usr/bin/env python3
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from report import emit, is_useful

URL = "https://www.instagram.com/beechtree_pk/"


def main() -> int:
    started = time.perf_counter()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        return emit("Playwright", "Instagram", URL, time.perf_counter() - started, status="FAILED", reason=str(exc))

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            ))
            page.goto(URL, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(8000)
            data = page.evaluate(
                """() => {
                  const og = document.querySelector('meta[property="og:title"]');
                  const links = [...document.querySelectorAll('a[href]')].map(a => a.href);
                  const imgs = [...document.querySelectorAll('img')].map(i => i.src).filter(Boolean);
                  return {
                    title: document.title,
                    og: og ? og.content : null,
                    text: (document.body && document.body.innerText || '').slice(0, 4000),
                    links, imgs
                  };
                }"""
            )
            browser.close()
        name = data.get("og") or data.get("title")
        post_urls = []
        for href in data.get("links") or []:
            if "/p/" in href or "/reel/" in href:
                if href not in post_urls:
                    post_urls.append(href)
        images = [u for u in (data.get("imgs") or []) if "cdninstagram" in u or "scontent" in u or "fbcdn" in u]
        texts = [data.get("text") or ""]
        elapsed = time.perf_counter() - started
        if not is_useful(name, post_urls, texts, images):
            return emit("Playwright", "Instagram", URL, elapsed, status="FAILED", reason=f"Loaded page title={name!r} but no public posts/images extracted")
        return emit("Playwright", "Instagram", URL, elapsed, status="SUCCESS", profile_name=name, post_urls=post_urls, texts=texts, images=images)
    except Exception as exc:
        return emit("Playwright", "Instagram", URL, time.perf_counter() - started, status="FAILED", reason=f"{type(exc).__name__}: {exc}")


if __name__ == "__main__":
    raise SystemExit(main())
