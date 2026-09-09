"""Shared stdout format for isolated scraper experiments. Not used by the app."""
from __future__ import annotations

GENERIC_TITLES = {
    "",
    "facebook",
    "instagram",
    "log in",
    "login",
    "error",
    "log into facebook",
    "instagram • log in",
}


def is_useful(profile_name: str | None, post_urls: list[str], texts: list[str], images: list[str]) -> bool:
    name = (profile_name or "").strip()
    if name and name.lower() not in GENERIC_TITLES and "log in" not in name.lower():
        return True
    if post_urls:
        return True
    if any((t or "").strip() for t in texts):
        return True
    if images:
        return True
    return False


def emit(
    scraper: str,
    platform: str,
    url: str,
    elapsed: float,
    *,
    status: str,
    profile_name: str | None = None,
    post_urls: list[str] | None = None,
    texts: list[str] | None = None,
    images: list[str] | None = None,
    reason: str | None = None,
    notes: str | None = None,
) -> int:
    post_urls = post_urls or []
    texts = [t for t in (texts or []) if (t or "").strip()]
    images = [i for i in (images or []) if i]
    print("=" * 48)
    print(f"SCRAPER: {scraper}")
    print(f"PLATFORM: {platform}")
    print(f"URL: {url}")
    print("=" * 48)
    print()
    print(f"Status: {status}")
    print()
    if status == "SUCCESS":
        print("Data extracted:")
        print(f"- Profile/Page name: {profile_name or '(none)'}")
        print(f"- Number of posts found: {len(post_urls)}")
        shown = post_urls[:5]
        print(f"- Post URLs found: {shown or '(none)'}")
        print(f"- Text extracted: {'Yes' if texts else 'No'}")
        if texts:
            preview = texts[0].replace("\n", " ")[:120]
            print(f"  preview: {preview}")
        print(f"- Images found: {'Yes' if images else 'No'}")
        if notes:
            print(f"- Notes: {notes}")
    else:
        print("Reason:")
        print(reason or "No useful public data extracted")
        if notes:
            print(f"Notes: {notes}")
    print()
    print(f"Execution time: {elapsed:.1f} seconds")
    return 0 if status == "SUCCESS" else 1
