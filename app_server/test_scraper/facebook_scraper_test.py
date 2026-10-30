#!/usr/bin/env python3
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from report import emit, is_useful

URL = "https://www.facebook.com/SoKamalOfficial"


def main() -> int:
    started = time.perf_counter()
    try:
        from facebook_scraper import get_posts, set_cookies, set_user_agent
    except ImportError as exc:
        return emit("facebook-scraper", "Facebook", URL, time.perf_counter() - started, status="FAILED", reason=str(exc))

    cookie_file = (os.environ.get("FACEBOOK_COOKIES_FILE") or "").strip()
    try:
        set_user_agent(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
        )
        if cookie_file and Path(cookie_file).is_file():
            try:
                set_cookies(cookie_file)
            except Exception as exc:
                return emit(
                    "facebook-scraper", "Facebook", URL, time.perf_counter() - started, status="FAILED",
                    reason=f"Cookie load failed: {type(exc).__name__}: {exc}",
                )
        posts = []
        for post in get_posts(account="SoKamalOfficial", pages=2, extra_info=False, timeout=30):
            if not isinstance(post, dict):
                continue
            posts.append(post)
            if len(posts) >= 5:
                break
        post_urls = [p.get("post_url") or p.get("link") for p in posts if p.get("post_url") or p.get("link")]
        texts = [p.get("text") or p.get("post_text") or "" for p in posts]
        images = []
        for p in posts:
            if p.get("image"):
                images.append(p["image"])
            for img in p.get("images") or []:
                if img:
                    images.append(img)
        elapsed = time.perf_counter() - started
        if not is_useful("SoKamalOfficial" if posts else None, post_urls, texts, images):
            return emit("facebook-scraper", "Facebook", URL, elapsed, status="FAILED", reason="Library returned no posts with caption or media")
        return emit(
            "facebook-scraper", "Facebook", URL, elapsed, status="SUCCESS",
            profile_name="SoKamalOfficial", post_urls=post_urls, texts=texts, images=images,
        )
    except Exception as exc:
        return emit("facebook-scraper", "Facebook", URL, time.perf_counter() - started, status="FAILED", reason=f"{type(exc).__name__}: {exc}")


if __name__ == "__main__":
    raise SystemExit(main())
