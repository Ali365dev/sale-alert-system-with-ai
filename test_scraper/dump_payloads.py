#!/usr/bin/env python3
"""Dump raw-ish JSON from each isolated probe. Not used by the app."""
from __future__ import annotations

import json
import os
import sys
import traceback
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

FB = "https://www.facebook.com/SoKamalOfficial"
IG = "https://www.instagram.com/beechtree_pk/"
OUT = ROOT / "payloads"
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)
EVAL_JS = """() => {
  const og = document.querySelector('meta[property="og:title"]');
  const desc = document.querySelector('meta[property="og:description"]');
  const links = [...document.querySelectorAll('a[href]')].map(a => a.href);
  const imgs = [...document.querySelectorAll('img')].map(i => i.src).filter(Boolean);
  return {
    title: document.title,
    ogTitle: og ? og.content : null,
    ogDescription: desc ? desc.content : null,
    text: (document.body && document.body.innerText || '').slice(0, 8000),
    links, imgs
  };
}"""


def _write(name: str, payload: object) -> None:
    OUT.mkdir(exist_ok=True)
    path = OUT / f"{name}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(f"wrote {path} ({path.stat().st_size} bytes)")


def _slim_html(text: str, limit: int = 4000) -> dict:
    return {"length": len(text or ""), "head": (text or "")[:limit]}


def dump_httpx(platform: str, url: str) -> None:
    import httpx
    from selectolax.parser import HTMLParser

    with httpx.Client(follow_redirects=True, timeout=30.0, headers={"User-Agent": UA}) as client:
        r = client.get(url)
    html = HTMLParser(r.text)
    title = html.css_first("title")
    og = html.css_first('meta[property="og:title"]')
    desc = html.css_first('meta[property="og:description"]')
    _write(
        f"httpx_selectolax_{platform.lower()}",
        {
            "status_code": r.status_code,
            "final_url": str(r.url),
            "title": title.text() if title else None,
            "og_title": og.attributes.get("content") if og else None,
            "og_description": desc.attributes.get("content") if desc else None,
            "hrefs": [(n.attributes.get("href") or "") for n in html.css("a[href]")][:100],
            "img_srcs": [(n.attributes.get("src") or "") for n in html.css("img[src]")][:50],
            "html": _slim_html(r.text),
        },
    )


def dump_scrapling(platform: str, url: str) -> None:
    from scrapling.fetchers import Fetcher

    page = Fetcher.get(url) if hasattr(Fetcher, "get") else Fetcher.fetch(url)
    html = getattr(page, "html", None) or getattr(page, "text", "") or ""
    if not isinstance(html, str):
        html = str(html)
    payload = {
        "status": getattr(page, "status", getattr(page, "status_code", None)),
        "url": getattr(page, "url", url),
        "html": _slim_html(html, 8000),
    }
    try:
        payload["title"] = page.css("title::text").get()
        payload["og_title"] = page.css('meta[property="og:title"]::attr(content)').get()
        payload["og_description"] = page.css('meta[property="og:description"]::attr(content)').get()
    except Exception as exc:
        payload["css_error"] = f"{type(exc).__name__}: {exc}"
    _write(f"scrapling_{platform.lower()}", payload)


def dump_browser(kind: str, platform: str, url: str) -> None:
    if kind == "playwright":
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page(user_agent=UA)
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(8000)
            data = page.evaluate(EVAL_JS)
            browser.close()
    else:
        from camoufox.sync_api import Camoufox

        with Camoufox(headless=True, os="macos") as browser:
            page = browser.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(8000)
            data = page.evaluate(EVAL_JS)
    _write(f"{kind}_{platform.lower()}", data)


def dump_facebook_scraper() -> None:
    from facebook_scraper import get_posts, set_user_agent

    set_user_agent(UA)
    posts = []
    try:
        for post in get_posts(account="SoKamalOfficial", pages=2, extra_info=False, timeout=30):
            if isinstance(post, dict):
                posts.append(post)
            if len(posts) >= 5:
                break
        _write("facebook_scraper", {"posts": posts, "count": len(posts)})
    except Exception as extra:
        _write("facebook_scraper", {"error": f"{type(extra).__name__}: {extra}", "posts": posts})


def dump_apify(platform: str, actor: str) -> None:
    from apify_client import ApifyClient

    token = (os.environ.get("APIFY_TOKEN") or os.environ.get("APIFY_API_TOKEN") or "").strip()
    if not token:
        _write(f"apify_{platform.lower()}", {"error": "APIFY_TOKEN is not configured. Skipping Apify test."})
        return
    client = ApifyClient(token)
    collection = client.actor(actor).runs()
    last = collection.list(status="SUCCEEDED", limit=1)
    items_page = last.items if hasattr(last, "items") else last.get("items") if isinstance(last, dict) else []
    run_info = items_page[0] if items_page else None
    dataset_id = None
    run_id = None
    if isinstance(run_info, dict):
        run_id = run_info.get("id")
        dataset_id = run_info.get("defaultDatasetId")
    elif run_info is not None:
        run_id = getattr(run_info, "id", None)
        dataset_id = getattr(run_info, "default_dataset_id", None)
    items = list(client.dataset(dataset_id).iterate_items()) if dataset_id else []
    _write(
        f"apify_{platform.lower()}",
        {
            "actor": actor,
            "run_id": run_id,
            "dataset_id": dataset_id,
            "item_count": len(items),
            "items": items,
        },
    )


def main() -> int:
    try:
        from dotenv import load_dotenv

        load_dotenv(ROOT / ".env")
        load_dotenv(ROOT.parent / ".env")
        if not os.environ.get("APIFY_TOKEN") and os.environ.get("APIFY_API_TOKEN"):
            os.environ["APIFY_TOKEN"] = os.environ["APIFY_API_TOKEN"]
    except Exception:
        pass

    jobs = [
        ("httpx facebook", lambda: dump_httpx("Facebook", FB)),
        ("httpx instagram", lambda: dump_httpx("Instagram", IG)),
        ("scrapling facebook", lambda: dump_scrapling("Facebook", FB)),
        ("scrapling instagram", lambda: dump_scrapling("Instagram", IG)),
        ("camoufox facebook", lambda: dump_browser("camoufox", "Facebook", FB)),
        ("camoufox instagram", lambda: dump_browser("camoufox", "Instagram", IG)),
        ("playwright facebook", lambda: dump_browser("playwright", "Facebook", FB)),
        ("playwright instagram", lambda: dump_browser("playwright", "Instagram", IG)),
        ("facebook-scraper", dump_facebook_scraper),
        ("apify facebook", lambda: dump_apify("Facebook", "apify/facebook-posts-scraper")),
        ("apify instagram", lambda: dump_apify("Instagram", "apify/instagram-scraper")),
    ]
    for label, fn in jobs:
        print(f"dumping {label}…")
        try:
            fn()
        except Exception as extra:
            _write(label.replace(" ", "_").replace("-", "_"), {"error": f"{type(extra).__name__}: {extra}", "traceback": traceback.format_exc()})
    print("done", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
