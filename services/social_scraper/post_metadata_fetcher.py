"""Best-effort preview fetch for ONE specific, already-known post URL.

Deliberately not a scraper: this never logs in and never lists/browses a
profile's posts — Meta's Terms of Service leave no compliant way to do that
for a profile the admin's app hasn't been granted API access to, and
building around that (via a logged-in bot account) would mean building
anti-bot-detection evasion against Meta's own anti-abuse systems, which this
app does not do regardless of end use.

What this *does* do: a single unauthenticated GET on a URL the admin already
pasted in, reading whatever `og:title`/`og:description`/`og:image` tags that
page's own server-rendered HTML exposes — the exact same mechanism a chat
app (Slack/Discord/iMessage) uses to render a link preview when you paste a
URL. Facebook posts often expose these (Meta wants shared links to preview
well); Instagram gates most content behind a login wall, so this frequently
comes back empty for Instagram — that's expected, not a bug. The caller
(services/social_scraper/content_pipeline.py, and both new admin pages)
always lets the admin fill in caption/image manually regardless of what
this returns.
"""
from typing import Optional, TypedDict

from services.brand_discovery.crawler import fetch_page

SOURCE = "post_metadata"


class PreviewResult(TypedDict):
    caption: Optional[str]
    image_url: Optional[str]
    source: Optional[str]


def _meta(soup, prop: str) -> Optional[str]:
    tag = soup.find("meta", property=prop)
    if not tag:
        return None
    content = (tag.get("content") or "").strip()
    return content or None


def fetch_preview(platform: str, post_url: str) -> PreviewResult:
    page = fetch_page(post_url)
    if page is None:
        return {"caption": None, "image_url": None, "source": None}

    caption = _meta(page.soup, "og:description") or _meta(page.soup, "og:title")
    image_url = _meta(page.soup, "og:image")

    if not caption and not image_url:
        return {"caption": None, "image_url": None, "source": None}

    return {"caption": caption, "image_url": image_url, "source": SOURCE}
