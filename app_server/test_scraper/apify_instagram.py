#!/usr/bin/env python3
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from report import emit, is_useful

URL = "https://www.instagram.com/beechtree_pk/"
ACTOR = "apify/instagram-scraper"


def main() -> int:
    started = time.perf_counter()
    token = (os.environ.get("APIFY_TOKEN") or "").strip()
    if not token:
        return emit(
            "Apify", "Instagram", URL, time.perf_counter() - started, status="FAILED",
            reason="APIFY_TOKEN is not configured. Skipping Apify test.",
        )
    try:
        from apify_client import ApifyClient
    except ImportError as extra:
        return emit("Apify", "Instagram", URL, time.perf_counter() - started, status="FAILED", reason=str(extra))

    try:
        client = ApifyClient(token)
        run = client.actor(ACTOR).call(
            run_input={"directUrls": [URL], "resultsType": "posts", "resultsLimit": 5},
        )
        dataset_id = getattr(run, "default_dataset_id", None) or (run.get("defaultDatasetId") if isinstance(run, dict) else None)
        items = list(client.dataset(dataset_id).iterate_items())
        post_urls, texts, images = [], [], []
        name = None
        for item in items:
            if not isinstance(item, dict):
                continue
            name = name or item.get("ownerFullName") or item.get("ownerUsername")
            url = item.get("url") or item.get("inputUrl")
            if url:
                post_urls.append(url)
            text = item.get("caption") or item.get("text")
            if text:
                texts.append(text)
            img = item.get("displayUrl")
            if img:
                images.append(img)
        elapsed = time.perf_counter() - started
        if not is_useful(name or "beechtree_pk" if items else None, post_urls, texts, images):
            return emit("Apify", "Instagram", URL, elapsed, status="FAILED", reason=f"Actor {ACTOR} returned {len(items)} item(s) but no useful post fields")
        return emit("Apify", "Instagram", URL, elapsed, status="SUCCESS", profile_name=name or "beechtree_pk", post_urls=post_urls, texts=texts, images=images, notes=f"actor={ACTOR}")
    except Exception as extra:
        return emit("Apify", "Instagram", URL, time.perf_counter() - started, status="FAILED", reason=f"{type(extra).__name__}: {extra}")


if __name__ == "__main__":
    raise SystemExit(main())
