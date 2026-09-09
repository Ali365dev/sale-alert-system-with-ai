"""HTTPX fetch + relevant-page discovery for one brand's website. Ported from
the validated research spike's crawl.py/config.py (PRIORITY_TERMS,
score_url/prioritize_urls) — same scoring, generalized from one hardcoded
BASE_URL to a brand's configured + discovered URLs (spec §3: "do not blindly
crawl an entire website")."""
from __future__ import annotations

import time
from urllib.parse import urlparse

from config import (
    WEBSITE_SCRAPE_MAX_PAGES,
    WEBSITE_SCRAPE_REQUEST_DELAY_SECONDS,
    WEBSITE_SCRAPE_TIMEOUT_SECONDS,
    WEBSITE_SCRAPE_USER_AGENT,
)
from services.website_scraper.extractor import extract_links, is_internal, is_product_url
from services.website_scraper.models import DiscoveredUrl

PRIORITY_TERMS = (
    "sale", "sales", "offer", "offers", "discount", "discounts", "deal", "deals",
    "promotion", "promotions", "clearance", "special-offer", "campaign", "coupon",
    "promo", "outlet", "collection", "collections", "product", "products",
)
_HIGH_VALUE_TERMS = {
    "sale", "sales", "offer", "offers", "discount", "discounts", "deal", "deals",
    "clearance", "special-offer", "promotion", "promotions", "outlet",
}


def fetch_html(url: str, *, timeout: float = WEBSITE_SCRAPE_TIMEOUT_SECONDS) -> tuple[int, str, str]:
    """Returns (status_code, html, final_url). Raises on connection failure —
    callers decide how to record that as an ERROR scrape_status."""
    import httpx

    headers = {
        "User-Agent": WEBSITE_SCRAPE_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    }
    with httpx.Client(follow_redirects=True, timeout=timeout, headers=headers) as client:
        response = client.get(url)
    return response.status_code, response.text, str(response.url)


# Statuses where a plain HTTP client commonly gets a WAF/bot-mitigation block
# page (Akamai, Cloudflare, PerimeterX, ...) even though the page itself is
# fully public — a real browser passes the same check because it actually
# renders JS and carries a genuine browser TLS/HTTP fingerprint.
_BLOCK_LIKE_STATUSES = (403, 406, 429, 503)
# Adidas (and similar Akamai Bot Manager sites) often return HTTP 200 with a
# JS challenge, or HTTP 403 with a branded "unable to give you access" page.
# Treating those as success left brands like Adidas at 0 pages discovered.
_BLOCK_HTML_MARKERS = (
    "waffailover",
    "unable to give you access to our site",
    "sec-if-cpt-container",
    "scf-akamai-protected-by",
    "powered and protected by",
)


def html_looks_blocked(status: int, html: str | None) -> bool:
    text = html or ""
    if status in _BLOCK_LIKE_STATUSES:
        return True
    if status < 300 and len(text) < 800:
        return True
    lowered = text.lower()
    return any(marker in lowered for marker in _BLOCK_HTML_MARKERS)


def _akamai_needs_stealth(html: str | None) -> bool:
    lowered = (html or "").lower()
    return any(marker in lowered for marker in _BLOCK_HTML_MARKERS)


def fetch_html_browser(url: str, *, timeout: float = WEBSITE_SCRAPE_TIMEOUT_SECONDS) -> tuple[int, str, str]:
    """Headless-Chromium fallback for pages a plain HTTPX request can't get
    past. Returns (status_code, html, final_url) — status is the last
    response's HTTP status for the navigated URL (200 assumed if Playwright
    doesn't expose one, e.g. for about:blank edge cases)."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        try:
            page = browser.new_page(user_agent=WEBSITE_SCRAPE_USER_AGENT)
            response = page.goto(url, timeout=timeout * 1000, wait_until="domcontentloaded")
            html = page.content()
            final_url = page.url
            status = response.status if response else 200
            return status, html, final_url
        finally:
            browser.close()


def fetch_html_camoufox(url: str, *, timeout: float = WEBSITE_SCRAPE_TIMEOUT_SECONDS) -> tuple[int, str, str]:
    """Firefox-based Camoufox fallback. Stock Playwright Chromium is still
    fingerprinted by Akamai Bot Manager (adidas.com returns 403); Camoufox
    loads the real storefront."""
    import sys

    from camoufox.sync_api import Camoufox

    kwargs: dict = {"headless": True}
    if sys.platform == "darwin":
        kwargs["os"] = "macos"
    with Camoufox(**kwargs) as browser:
        page = browser.new_page()
        response = page.goto(url, timeout=timeout * 1000, wait_until="domcontentloaded")
        page.wait_for_timeout(min(8000, int(timeout * 250)))
        html = page.content()
        final_url = page.url
        status = response.status if response else 200
        return status, html, final_url


def fetch_html_with_fallback(url: str, *, timeout: float = WEBSITE_SCRAPE_TIMEOUT_SECONDS) -> tuple[int, str, str, bool]:
    """HTTPX first; Playwright Chromium if blocked; Camoufox if Chromium is
    still a WAF/challenge page (Adidas). Returns
    (status, html, final_url, browser_attempted)."""
    status, html, final_url = fetch_html(url, timeout=timeout)
    if not html_looks_blocked(status, html):
        return status, html, final_url, False

    best_status, best_html, best_url = status, html, final_url
    attempted = False

    if not _akamai_needs_stealth(html):
        try:
            b_status, b_html, b_final_url = fetch_html_browser(url, timeout=timeout)
            attempted = True
            if not html_looks_blocked(b_status, b_html) and len(b_html or "") > len(best_html or ""):
                return b_status, b_html, b_final_url, True
            if len(b_html or "") > len(best_html or ""):
                best_status, best_html, best_url = b_status, b_html, b_final_url
        except Exception:
            attempted = True

    try:
        c_status, c_html, c_final_url = fetch_html_camoufox(url, timeout=max(timeout, 45.0))
        attempted = True
        if not html_looks_blocked(c_status, c_html):
            return c_status, c_html, c_final_url, True
        if len(c_html or "") > len(best_html or ""):
            best_status, best_html, best_url = c_status, c_html, c_final_url
    except ImportError:
        attempted = True
    except Exception:
        attempted = True

    return best_status, best_html, best_url, attempted


def score_url(url: str) -> int:
    path = urlparse(url).path.lower().rstrip("/") or "/"
    score = 0
    for term in PRIORITY_TERMS:
        if term in path:
            score += 3 if term in _HIGH_VALUE_TERMS else 1
    if "/collections/" in path or "/sale/" in path or path == "/sale":
        score += 2
    last = path.rsplit("/", 1)[-1]
    # Prefer the site-wide sale hub (/us/sale) over niche /baseball-sale pages.
    if last in {"sale", "outlet", "clearance"}:
        score += 12
    elif last in {"offers", "promotions"}:
        score += 6
    elif last.endswith("-sale") or last.endswith("_sale") or last.endswith("-outlet"):
        score += 2
    if "/products/" in path or path.endswith(".html"):
        score += 1
    return score


def discover_pages(
    homepage_url: str,
    configured_urls: list[tuple[str, str]],  # [(url, page_type), ...] e.g. [(sale_url, "sale")]
    *,
    max_pages: int = WEBSITE_SCRAPE_MAX_PAGES,
    delay: float = WEBSITE_SCRAPE_REQUEST_DELAY_SECONDS,
) -> tuple[list[DiscoveredUrl], list[str]]:
    """Fetches the homepage (+ any explicitly configured URLs), discovers
    internal links, and returns a prioritized list of up to `max_pages` URLs
    worth scraping, plus any fetch errors encountered along the way."""
    target_host = (urlparse(homepage_url).netloc or "").lower()
    errors: list[str] = []
    queue: list[DiscoveredUrl] = [DiscoveredUrl(url=homepage_url, page_type="homepage", score=999)]
    for url, page_type in configured_urls:
        if url and url != homepage_url:
            queue.append(DiscoveredUrl(url=url, page_type=page_type, score=998))

    seen: set[str] = set()
    result: list[DiscoveredUrl] = []
    discovered_links: list[str] = []

    for item in queue:
        if len(result) >= max_pages or item.url in seen:
            continue
        seen.add(item.url)
        if result:
            time.sleep(delay)
        try:
            status, html, final_url, used_browser = fetch_html_with_fallback(item.url)
        except Exception as exc:
            errors.append(f"{item.url}: {type(exc).__name__}: {exc}")
            continue
        if status >= 400 or not html:
            suffix = " (browser fallback also blocked)" if used_browser else ""
            errors.append(f"{final_url or item.url}: HTTP {status}{suffix}")
            continue
        result.append(item)
        discovered_links.extend(extract_links(html, final_url or item.url, target_host))

    remaining = [u for u in discovered_links if u not in seen and is_internal(u, target_host)]
    ranked = sorted(dict.fromkeys(remaining), key=lambda u: (-score_url(u), u))
    slots_left = max_pages - len(result)
    for url in ranked:
        if slots_left <= 0:
            break
        if url in seen:
            continue
        seen.add(url)
        page_type = "custom" if is_product_url(url) else "discovered"
        result.append(DiscoveredUrl(url=url, page_type=page_type, score=score_url(url)))
        slots_left -= 1

    return result, errors
