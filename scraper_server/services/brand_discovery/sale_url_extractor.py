"""Finds URLs on a brand's website that likely lead to sale, deals, or
promotional content — without following the links (pure href analysis).
"""
import re
from urllib.parse import urljoin, urlparse

_PATH_HINTS = (
    "sale", "sales", "deals", "deal", "offer", "offers", "promo", "promotion",
    "promotions", "discount", "discounts", "clearance", "outlet", "savings",
    "special", "coupon", "coupons", "flash", "percent-off", "off",
    "new-arrivals", "best-sellers", "featured",
)

_TEXT_HINTS = (
    "sale", "deals", "offers", "promo", "promotions", "discounts",
    "clearance", "outlet", "savings", "coupons", "flash sale",
)

_SKIP_EXTENSIONS = re.compile(r"\.(png|jpg|jpeg|gif|svg|webp|ico|pdf|zip|js|css|xml|json)(\?|$)", re.I)


def _score_href(href: str, link_text: str) -> int:
    """Returns a relevance score > 0 if the href looks sale-related."""
    if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
        return 0
    if _SKIP_EXTENSIONS.search(href):
        return 0
    path = urlparse(href).path.lower()
    score = 0
    for hint in _PATH_HINTS:
        if hint in path:
            score += 2
            break
    text_lower = link_text.lower()
    for hint in _TEXT_HINTS:
        if hint in text_lower:
            score += 1
            break
    return score


def extract_sale_urls(pages: dict) -> list[str]:
    """Returns deduplicated sale/deals URLs found across all crawled pages,
    ranked by relevance score, capped at 5."""
    scored: dict[str, int] = {}

    for page in pages.values():
        if page is None:
            continue
        base = page.url
        for a in page.soup.find_all("a", href=True):
            href = a["href"].strip()
            text = a.get_text(" ", strip=True)
            score = _score_href(href, text)
            if score <= 0:
                continue
            full = urljoin(base, href).rstrip("/")
            # Only keep links on the same domain
            if urlparse(full).netloc != urlparse(base).netloc:
                continue
            if full not in scored or scored[full] < score:
                scored[full] = score

    ranked = sorted(scored, key=lambda u: scored[u], reverse=True)
    return ranked[:5]
