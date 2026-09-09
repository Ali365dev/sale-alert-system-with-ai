#!/usr/bin/env python3
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from report import emit, is_useful

URL = "https://www.facebook.com/SoKamalOfficial"


def main() -> int:
    started = time.perf_counter()
    try:
        from camoufox.sync_api import Camoufox
    except ImportError as exc:
        return emit("Camoufox", "Facebook", URL, time.perf_counter() - started, status="FAILED", reason=str(exc))

    try:
        with Camoufox(headless=True, os="macos") as browser:
            page = browser.new_page()
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
        name = data.get("og") or data.get("title")
        post_urls = []
        for href in data.get("links") or []:
            if "/posts/" in href or "/videos/" in href or "story_fbid=" in href:
                if href not in post_urls:
                    post_urls.append(href)
        images = [u for u in (data.get("imgs") or []) if "scontent" in u or "fbcdn" in u]
        texts = [data.get("text") or ""] if data.get("text") and "log in" not in (data.get("text") or "").lower()[:80] else []
        elapsed = time.perf_counter() - started
        if not is_useful(name, post_urls, texts, images):
            return emit("Camoufox", "Facebook", URL, elapsed, status="FAILED", reason=f"Loaded page title={name!r} but no public posts/images extracted")
        return emit("Camoufox", "Facebook", URL, elapsed, status="SUCCESS", profile_name=name, post_urls=post_urls, texts=texts, images=images)
    except Exception as exc:
        return emit("Camoufox", "Facebook", URL, time.perf_counter() - started, status="FAILED", reason=f"{type(exc).__name__}: {exc}")


if __name__ == "__main__":
    raise SystemExit(main())
