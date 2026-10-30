"""HTTPX fetch + relevant-page discovery for one brand's website. Ported from
the validated research spike's crawl.py/config.py (PRIORITY_TERMS,
score_url/prioritize_urls) — same scoring, generalized from one hardcoded
BASE_URL to a brand's configured + discovered URLs (spec §3: "do not blindly
crawl an entire website")."""
from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor
from concurrent.futures import TimeoutError as FuturesTimeoutError
from urllib.parse import urlparse

from config import (
    WEBSITE_SCRAPE_BROWSER_TIMEOUT_SECONDS,
    WEBSITE_SCRAPE_FETCH_BUDGET_SECONDS,
    WEBSITE_SCRAPE_MAX_PAGES,
    WEBSITE_SCRAPE_REQUEST_DELAY_SECONDS,
    WEBSITE_SCRAPE_TIMEOUT_SECONDS,
    WEBSITE_SCRAPE_TOP_DISCOVERED_LINKS,
    WEBSITE_SCRAPE_USER_AGENT,
)
from services.website_scraper.extractor import (
    extract_links,
    extract_nav_footer_links,
    is_internal,
    is_product_url,
)
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

# Minimum remaining budget (seconds) before attempting a browser fallback.
_MIN_BROWSER_BUDGET_SECONDS = 5.0
_MIN_CAMOUFOX_BUDGET_SECONDS = 8.0


class FetchDeadlineExceeded(TimeoutError):
    """A fetch stage exceeded its hard wall-clock limit and was abandoned."""


def _call_with_deadline(fn, *, seconds: float, label: str):
    """Run ``fn`` in a worker thread; abandon it if it exceeds ``seconds``.

    Uses ``shutdown(wait=False)`` so a hung Playwright/Camoufox call cannot
    block the job runner — the orphan thread may finish later, but control
    returns immediately so the scrape can move on.
    """
    if seconds <= 0:
        raise FetchDeadlineExceeded(f"{label} skipped — fetch budget exhausted")
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(fn)
    try:
        return future.result(timeout=seconds)
    except FuturesTimeoutError as exc:
        raise FetchDeadlineExceeded(f"{label} timed out after {seconds:.0f}s") from exc
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


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
    # Settle briefly after DOMContentLoaded so challenge JS can finish —
    # keep this short so a hung site does not burn the whole fetch budget.
    settle_ms = min(3000, max(500, int(timeout * 100)))
    with Camoufox(**kwargs) as browser:
        page = browser.new_page()
        response = page.goto(url, timeout=timeout * 1000, wait_until="domcontentloaded")
        page.wait_for_timeout(settle_ms)
        html = page.content()
        final_url = page.url
        status = response.status if response else 200
        return status, html, final_url


def fetch_html_with_fallback(
    url: str,
    *,
    timeout: float = WEBSITE_SCRAPE_TIMEOUT_SECONDS,
    budget_seconds: float | None = None,
) -> tuple[int, str, str, bool]:
    """HTTPX first; Playwright Chromium if blocked; Camoufox if Chromium is
    still a WAF/challenge page (Adidas). Returns
    (status, html, final_url, browser_attempted).

    Enforces a hard wall-clock ``budget_seconds`` across the whole chain so
    non-responsive sites are cancelled instead of blocking scrape-all.
    """
    budget = WEBSITE_SCRAPE_FETCH_BUDGET_SECONDS if budget_seconds is None else budget_seconds
    deadline = time.monotonic() + max(1.0, float(budget))
    browser_cap = max(1.0, float(WEBSITE_SCRAPE_BROWSER_TIMEOUT_SECONDS))

    def remaining() -> float:
        return max(0.0, deadline - time.monotonic())

    http_timeout = min(float(timeout), remaining())
    try:
        status, html, final_url = _call_with_deadline(
            lambda: fetch_html(url, timeout=http_timeout),
            seconds=http_timeout + 2.0,
            label="HTTPX fetch",
        )
    except FetchDeadlineExceeded:
        raise
    except Exception:
        # Connection errors still propagate so process_page records ERROR.
        raise

    if not html_looks_blocked(status, html):
        return status, html, final_url, False

    best_status, best_html, best_url = status, html, final_url
    attempted = False

    if not _akamai_needs_stealth(html) and remaining() >= _MIN_BROWSER_BUDGET_SECONDS:
        chrome_timeout = min(float(timeout), browser_cap, remaining() - 1.0)
        try:
            b_status, b_html, b_final_url = _call_with_deadline(
                lambda: fetch_html_browser(url, timeout=chrome_timeout),
                seconds=chrome_timeout + 3.0,
                label="Playwright Chromium",
            )
            attempted = True
            if not html_looks_blocked(b_status, b_html) and len(b_html or "") > len(best_html or ""):
                return b_status, b_html, b_final_url, True
            if len(b_html or "") > len(best_html or ""):
                best_status, best_html, best_url = b_status, b_html, b_final_url
        except FetchDeadlineExceeded:
            attempted = True
        except Exception:
            attempted = True

    if remaining() >= _MIN_CAMOUFOX_BUDGET_SECONDS:
        fox_timeout = min(float(timeout), browser_cap, remaining() - 1.0)
        try:
            c_status, c_html, c_final_url = _call_with_deadline(
                lambda: fetch_html_camoufox(url, timeout=fox_timeout),
                seconds=fox_timeout + 3.0,
                label="Camoufox",
            )
            attempted = True
            if not html_looks_blocked(c_status, c_html):
                return c_status, c_html, c_final_url, True
            if len(c_html or "") > len(best_html or ""):
                best_status, best_html, best_url = c_status, c_html, c_final_url
        except ImportError:
            attempted = True
        except FetchDeadlineExceeded:
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
    top_discovered: int = WEBSITE_SCRAPE_TOP_DISCOVERED_LINKS,
    delay: float = WEBSITE_SCRAPE_REQUEST_DELAY_SECONDS,
) -> tuple[list[DiscoveredUrl], list[str]]:
    """Build the scrape list for one brand:

    1. Homepage (fetched once — also sources nav/footer + sale links)
    2. All DB promo URLs (`sale` / `offers` / `promotions` / `custom`) — always
       included; never dropped by the top-N cap
    3. Top `top_discovered` ranked links from navbar/footer + sale-like paths

    Absolute ceiling is at least homepage + all promos + top_discovered (so the
    new nav/footer path is not silently trimmed by the older max_pages=8
    default). Extra custom URLs beyond that still trim with promo priority.
    """
    target_host = (urlparse(homepage_url).netloc or "").lower()
    errors: list[str] = []
    result: list[DiscoveredUrl] = []
    seen: set[str] = set()
    page_ceiling = max(max_pages, 1 + len(configured_urls) + max(0, top_discovered))

    homepage_html: str | None = None
    homepage_final = homepage_url
    try:
        status, html, final_url, used_browser = fetch_html_with_fallback(homepage_url)
        homepage_final = final_url or homepage_url
        if status >= 400 or not html:
            suffix = " (browser fallback also blocked)" if used_browser else ""
            errors.append(f"{homepage_final}: HTTP {status}{suffix}")
        else:
            homepage_html = html
            result.append(DiscoveredUrl(url=homepage_url, page_type="homepage", score=999))
            seen.add(homepage_url)
            if homepage_final != homepage_url:
                seen.add(homepage_final)
    except Exception as exc:
        errors.append(f"{homepage_url}: {type(exc).__name__}: {exc}")

    # DB-configured promo / custom URLs — always queued (existing behaviour).
    promo_items: list[DiscoveredUrl] = []
    for url, page_type in configured_urls:
        if not url or url in seen:
            continue
        item = DiscoveredUrl(url=url, page_type=page_type, score=998)
        promo_items.append(item)
        seen.add(url)

    # Nav/footer + sale-like links from the homepage HTML only.
    top_items: list[DiscoveredUrl] = []
    if homepage_html:
        nav_footer = extract_nav_footer_links(homepage_html, homepage_final, target_host)
        all_links = extract_links(homepage_html, homepage_final, target_host)
        scores: dict[str, int] = {}
        for url in all_links:
            if url in seen or not is_internal(url, target_host) or is_product_url(url):
                continue
            scores[url] = score_url(url)
        for url in nav_footer:
            if url in seen or not is_internal(url, target_host) or is_product_url(url):
                continue
            # Prefer chrome links even when the path has no sale keyword.
            scores[url] = max(scores.get(url, 0), score_url(url)) + 10

        ranked = sorted(scores.keys(), key=lambda u: (-scores[u], u))
        for url in ranked:
            if len(top_items) >= max(0, top_discovered):
                break
            page_type = "nav_footer" if url in nav_footer else "discovered"
            top_items.append(DiscoveredUrl(url=url, page_type=page_type, score=scores[url]))
            seen.add(url)

    # Assemble: homepage (already in result) + promos + top discovered, then
    # enforce absolute max_pages with promo priority after homepage.
    result.extend(promo_items)
    result.extend(top_items)

    if len(result) > page_ceiling:
        homepage_part = [r for r in result if r.page_type == "homepage"]
        promo_part = [r for r in result if r.page_type in {"sale", "offers", "promotions", "custom"}]
        discovered_part = [r for r in result if r.page_type in {"discovered", "nav_footer"}]
        remaining = page_ceiling - len(homepage_part)
        kept_promos = promo_part[:remaining]
        remaining -= len(kept_promos)
        kept_discovered = discovered_part[:remaining]
        result = homepage_part + kept_promos + kept_discovered
        if len(promo_part) > len(kept_promos) or len(discovered_part) > len(kept_discovered):
            errors.append(
                f"Page list trimmed to {page_ceiling} "
                f"(kept {len(kept_promos)} promo + {len(kept_discovered)} discovered)"
            )

    return result, errors
