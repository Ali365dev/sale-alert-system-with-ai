"""Fetches and parses a brand's website — homepage plus an about/contact
page if one can be found — for the other services in this package to pull
logo/description/category/social-link signals out of.

Deliberately request-only, no JS rendering: a static HTML fetch is enough
for the metadata/footer-link signals this feature looks for, and avoids
pulling in a headless-browser dependency for a free/no-cost feature.
"""
import re
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 DealPulseBrandDiscovery/1.0"
)
REQUEST_TIMEOUT_SECONDS = 10
MAX_RESPONSE_BYTES = 2_000_000
MAX_EXTRA_PAGES = 2  # about + contact, on top of the homepage

_ABOUT_HREF_HINTS = ("about-us", "about_us", "/about", "aboutus", "who-we-are", "our-story")
_CONTACT_HREF_HINTS = ("contact-us", "contact_us", "/contact", "contactus", "get-in-touch")


@dataclass
class ParsedPage:
    url: str          # the URL actually fetched (after redirects)
    soup: BeautifulSoup
    text: str          # visible text, whitespace-collapsed, capped


def _normalize_url(url: str) -> str:
    url = (url or "").strip()
    if not url:
        return ""
    if not re.match(r"^https?://", url, re.I):
        url = f"https://{url}"
    return url


def fetch_page(url: str) -> ParsedPage | None:
    """Fetches one page and parses it. Never raises — a broken/unreachable
    URL is just None, same treatment services/jobs/discover_brand.py gives
    a failed lookup."""
    url = _normalize_url(url)
    if not url:
        return None

    try:
        resp = requests.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"},
            timeout=REQUEST_TIMEOUT_SECONDS,
            stream=True,
            allow_redirects=True,
        )
    except requests.RequestException:
        return None

    try:
        if resp.status_code >= 400:
            return None
        content_type = resp.headers.get("content-type", "")
        if content_type and "html" not in content_type.lower():
            return None

        chunks = []
        total = 0
        for chunk in resp.iter_content(chunk_size=8192):
            total += len(chunk)
            if total > MAX_RESPONSE_BYTES:
                break
            chunks.append(chunk)
        html = b"".join(chunks).decode(resp.encoding or "utf-8", errors="ignore")
    except requests.RequestException:
        return None
    finally:
        resp.close()

    if not html.strip():
        return None

    soup = BeautifulSoup(html, "lxml")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = re.sub(r"\s+", " ", soup.get_text(" ")).strip()[:20000]

    return ParsedPage(url=str(resp.url), soup=soup, text=text)


def _find_link(soup: BeautifulSoup, base_url: str, hints: tuple[str, ...]) -> str | None:
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        haystack = f"{href} {a.get_text(' ', strip=True)}".lower()
        if any(hint in haystack for hint in hints):
            return urljoin(base_url, href)
    return None


def crawl_site(base_url: str) -> dict[str, ParsedPage | None]:
    """Fetches the homepage, then an about page and a contact page if links
    to either can be found on the homepage (checked across the whole page,
    not just nav/footer — small sites often only link these from a single
    spot). Returns {"home": ParsedPage|None, "about": ParsedPage|None,
    "contact": ParsedPage|None} — "home" is None only if the site is
    entirely unreachable, in which case the other two are always None too."""
    home = fetch_page(base_url)
    if home is None:
        return {"home": None, "about": None, "contact": None}

    about_url = _find_link(home.soup, home.url, _ABOUT_HREF_HINTS)
    contact_url = _find_link(home.soup, home.url, _CONTACT_HREF_HINTS)

    about = fetch_page(about_url) if about_url else None
    contact = fetch_page(contact_url) if contact_url and contact_url != about_url else None

    return {"home": home, "about": about, "contact": contact}


def domain_of(url: str) -> str:
    url = _normalize_url(url)
    if not url:
        return ""
    netloc = urlparse(url).netloc.lower()
    return netloc[4:] if netloc.startswith("www.") else netloc
