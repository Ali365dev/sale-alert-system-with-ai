"""Finds a brand's logo URL from a crawled homepage.

Priority order (most to least reliable): og:image meta tag, apple-touch-icon
link, rel=icon link, an <img> near the top of the page whose alt/class/id
says "logo", then a plain /favicon.ico guess as the last resort.
"""
from urllib.parse import urljoin

from services.brand_discovery.crawler import ParsedPage

SOURCE = "website_metadata"


def _resolve(base_url: str, href: str | None) -> str | None:
    href = (href or "").strip()
    if not href:
        return None
    return urljoin(base_url, href)


def extract_logo(page: ParsedPage) -> dict:
    og_image = page.soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        return {"value": _resolve(page.url, og_image["content"]), "source": SOURCE}

    apple_touch = page.soup.find("link", rel=lambda v: v and "apple-touch-icon" in v)
    if apple_touch and apple_touch.get("href"):
        return {"value": _resolve(page.url, apple_touch["href"]), "source": SOURCE}

    icon_link = page.soup.find("link", rel=lambda v: v and "icon" in v)
    if icon_link and icon_link.get("href"):
        return {"value": _resolve(page.url, icon_link["href"]), "source": SOURCE}

    for img in page.soup.find_all("img", limit=40):
        haystack = " ".join(
            str(img.get(attr, "")) for attr in ("alt", "class", "id", "src")
        ).lower()
        if "logo" in haystack and img.get("src"):
            return {"value": _resolve(page.url, img["src"]), "source": SOURCE}

    return {"value": _resolve(page.url, "/favicon.ico"), "source": "website_metadata"}
