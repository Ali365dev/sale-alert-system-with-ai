#!/usr/bin/env python3
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from report import emit, is_useful

URL = "https://www.facebook.com/SoKamalOfficial"
ACTOR = "apify/facebook-posts-scraper"


def main() -> int:
    started = time.perf_counter()
    token = (os.environ.get("APIFY_TOKEN") or "").strip()
    if not token:
        return emit(
            "Apify", "Facebook", URL, time.perf_counter() - started, status="FAILED",
            reason="APIFY_TOKEN is not configured. Skipping Apify test.",
        )
    try:
        from apify_client import ApifyClient
    except ImportError as exc:
        return emit("Apify", "Facebook", URL, time.perf_counter() - started, status="FAILED", reason=str(exc))

    try:
        client = ApifyClient(token)
        run = client.actor(ACTOR).call(
            run_input={"startUrls": [{"url": URL}], "resultsLimit": 5, "captionText": True},
        )
        dataset_id = getattr(run, "default_dataset_id", None) or (run.get("defaultDatasetId") if isinstance(run, dict) else None)
        items = list(client.dataset(dataset_id).iterate_items())
        post_urls, texts, images = [], [], []
        name = None
        for item in items:
            if not isinstance(item, dict):
                continue
            name = name or item.get("pageName") or item.get("user") or item.get("author")
            url = item.get("url") or item.get("postUrl") or item.get("facebookUrl")
            if url:
                post_urls.append(url)
            text = item.get("text") or item.get("message")
            if text:
                texts.append(text)
            img = item.get("image")
            if isinstance(img, str):
                images.append(img)
            for media in item.get("media") or []:
                if isinstance(media, str):
                    images.append(media)
                elif isinstance(media, dict) and (media.get("url") or media.get("src")):
                    images.append(media.get("url") or media.get("src"))
        elapsed = time.perf_counter() - started
        if not is_useful(name or "SoKamalOfficial" if items else None, post_urls, texts, images):
            return emit("Apify", "Facebook", URL, elapsed, status="FAILED", reason=f"Actor {ACTOR} returned {len(items)} item(s) but no useful post fields")
        return emit("Apify", "Facebook", URL, elapsed, status="SUCCESS", profile_name=name or "SoKamalOfficial", post_urls=post_urls, texts=texts, images=images, notes=f"actor={ACTOR}")
    except Exception as extra:
        return emit("Apify", "Facebook", URL, time.perf_counter() - started, status="FAILED", reason=f"{type(extra).__name__}: {extra}")


if __name__ == "__main__":
    raise SystemExit(main())
