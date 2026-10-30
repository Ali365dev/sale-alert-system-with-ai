"""Finds a brand's official social media profile links across its crawled
pages (home/about/contact) — never a share/like button, and never a
platform's own generic pages (their help/policy/about pages, which every
site's footer coincidentally links to).
"""
import re
from urllib.parse import urlparse

PLATFORMS = ("facebook", "instagram", "tiktok", "twitter", "youtube", "linkedin")

_DOMAIN_PATTERNS = {
    "facebook": re.compile(r"(?:^|\.)(facebook\.com|fb\.com|fb\.me)$", re.I),
    "instagram": re.compile(r"(?:^|\.)instagram\.com$", re.I),
    "tiktok": re.compile(r"(?:^|\.)tiktok\.com$", re.I),
    "twitter": re.compile(r"(?:^|\.)(twitter\.com|x\.com)$", re.I),
    "youtube": re.compile(r"(?:^|\.)(youtube\.com|youtu\.be)$", re.I),
    "linkedin": re.compile(r"(?:^|\.)linkedin\.com$", re.I),
}

# Share/intent buttons — a link that *triggers sharing*, not a profile.
_SHARE_PATH_HINTS = ("sharer", "share.php", "dialog/share", "intent/tweet", "intent/post", "shareArticle", "sharing/share-offsite")
_SHARE_QUERY_HINTS = ("u=", "url=", "text=")

# A platform's own generic pages — every footer links these, they are never
# the brand's own profile.
_GENERIC_PATH_HINTS = (
    "help", "policies", "policy", "legal", "about", "privacy", "terms", "tos",
    "developers", "business", "ads", "jobs", "careers", "press",
)


def _platform_for_domain(netloc: str) -> str | None:
    netloc = (netloc or "").lower()
    if netloc.startswith("www."):
        netloc = netloc[4:]
    for platform, pattern in _DOMAIN_PATTERNS.items():
        if pattern.search(netloc):
            return platform
    return None


def _looks_like_profile_link(parsed) -> bool:
    path = (parsed.path or "").strip("/")
    query = (parsed.query or "").lower()

    if not path:
        return False  # bare root, e.g. "https://facebook.com/" — not a profile
    if any(hint in path.lower() for hint in _SHARE_PATH_HINTS):
        return False
    if any(hint in query for hint in _SHARE_QUERY_HINTS):
        return False

    first_segment = path.split("/", 1)[0].lower()
    if first_segment in _GENERIC_PATH_HINTS:
        return False

    return True


def extract_social_links(pages: dict) -> dict:
    """`pages` is crawler.crawl_site()'s return shape: {"home": ParsedPage|None,
    "about": ParsedPage|None, "contact": ParsedPage|None}. Checked in that
    order so a homepage link always wins over one buried in a contact page.
    Returns {platform: {"url": str, "source": "home"|"about_page"|"contact_page"}}
    — only for platforms actually found."""
    source_labels = {"home": "home", "about": "about_page", "contact": "contact_page"}
    found: dict[str, dict] = {}

    for page_key in ("home", "about", "contact"):
        page = pages.get(page_key)
        if page is None:
            continue
        for a in page.soup.find_all("a", href=True):
            href = a["href"].strip()
            if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
                continue
            try:
                parsed = urlparse(href)
            except ValueError:
                continue
            if not parsed.netloc:
                continue

            platform = _platform_for_domain(parsed.netloc)
            if platform is None or platform in found:
                continue
            if not _looks_like_profile_link(parsed):
                continue

            found[platform] = {"url": href, "source": source_labels[page_key]}

    return found
