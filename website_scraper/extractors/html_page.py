"""HTML extraction for Shopify and Salesforce storefronts. Lab-only."""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import urljoin, urlparse, urlunparse

from config import BASE_URL, PRIORITY_TERMS, SKIP_PATH_PARTS, TARGET_HOST
from sale_detector import parse_money


def extract_visible_text(html: str, *, limit: int = 12000) -> str:
    from selectolax.parser import HTMLParser

    tree = HTMLParser(html)
    for node in tree.css("script, style, noscript"):
        node.decompose()
    text = tree.body.text(separator=" ") if tree.body else tree.text()
    return re.sub(r"\s+", " ", text or "").strip()[:limit]


def extract_links(html: str, page_url: str) -> list[str]:
    from selectolax.parser import HTMLParser

    tree = HTMLParser(html)
    found: list[str] = []
    seen: set[str] = set()
    for node in tree.css("a[href]"):
        href = (node.attributes.get("href") or "").strip()
        if not href:
            continue
        absolute = _clean_url(urljoin(page_url, href))
        if not _is_internal(absolute) or absolute in seen:
            continue
        seen.add(absolute)
        found.append(absolute)
    return found


def extract_products(html: str, page_url: str) -> list[dict[str, Any]]:
    from selectolax.parser import HTMLParser

    tree = HTMLParser(html)
    products: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(name, url, original, current, source: str) -> None:
        if not name and current is None:
            return
        if url in seen:
            return
        seen.add(url)
        products.append(
            {
                "name": name,
                "current_price": current,
                "original_price": original,
                "discount_percentage": None,
                "url": url,
                "source": source,
            }
        )

    for info in tree.css(".t4s-product-info"):
        title_a = info.css_first(".t4s-product-title a") or info.css_first("a[href*='/products/']")
        price_el = info.css_first(".t4s-product-price")
        name = title_a.text(strip=True) if title_a else None
        href = title_a.attributes.get("href") if title_a else None
        url = _clean_url(urljoin(page_url, href)) if href else page_url
        original, current = _prices_from_price_node(price_el)
        add(name, url, original, current, "html-card")

    for tile in tree.css(".product-tile"):
        link = tile.css_first("a.plpRedirectPdp") or tile.css_first("a[href*='.html']") or tile.css_first("a[href]")
        href = link.attributes.get("href") if link else None
        url = _clean_url(urljoin(page_url, href)) if href else page_url
        img = tile.css_first("img.tile-image") or tile.css_first("img")
        alt = (img.attributes.get("alt") if img else "") or ""
        name = _name_from_alt(alt) or (link.text(strip=True) if link else None)
        original, current = _prices_from_text(tile.text())
        if current is None:
            original, current = _prices_from_text(alt)
        add(name, url, original, current, "html-tile")

    if is_product_url(page_url) and _clean_url(page_url) not in seen:
        title = tree.css_first("h1")
        price_el = (
            tree.css_first(".t4s-product-price")
            or tree.css_first(".price__sale")
            or tree.css_first(".t4s-price")
            or tree.css_first(".prices")
            or tree.css_first(".product-price")
        )
        original, current = _prices_from_price_node(price_el)
        if current is None:
            original, current = _prices_from_text(tree.body.text() if tree.body else "")
        add(title.text(strip=True) if title else None, _clean_url(page_url), original, current, "html-pdp")
    return products


def score_url(url: str) -> int:
    path = urlparse(url).path.lower()
    score = 0
    for term in PRIORITY_TERMS:
        if term in path:
            score += 3 if term in {"sale", "sales", "offer", "offers", "discount", "clearance", "deal", "deals"} else 1
    if "/collections/" in path or "/sale/" in path or path.rstrip("/") == "/sale":
        score += 2
    if "/products/" in path or path.endswith(".html"):
        score += 1
    return score


def prioritize_urls(urls: list[str], *, limit: int) -> list[str]:
    ranked = sorted({u for u in urls if _is_internal(u)}, key=lambda u: (-score_url(u), u))
    return [u for u in ranked if score_url(u) > 0][:limit]


def is_product_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    if "/products/" in path:
        return True
    if path.endswith(".html") and "shopthelook" not in path:
        return True
    return False


def _name_from_alt(alt: str) -> str | None:
    parts = [p.strip() for p in (alt or "").split("|") if p.strip()]
    named = [p for p in parts if not re.match(r"^(?:rs\.?|pkr)", p, re.I)]
    if len(named) >= 2:
        return named[-1]
    return named[0] if named else None


def _prices_from_text(text: str) -> tuple[float | None, float | None]:
    amounts = [parse_money(m.group(0)) for m in re.finditer(r"(?:Rs\.?|PKR|₨)\s*[\d,]+", text or "")]
    amounts = [a for a in amounts if a is not None and a >= 20]
    if not amounts:
        return None, None
    if len(amounts) == 1:
        return None, amounts[0]
    high, low = max(amounts), min(amounts)
    if high > low:
        return high, low
    return None, low


def _prices_from_price_node(node) -> tuple[float | None, float | None]:
    if node is None:
        return None, None
    deleted = node.css_first("del")
    inserted = node.css_first("ins")
    original = parse_money(deleted.text()) if deleted else None
    current = parse_money(inserted.text()) if inserted else parse_money(node.text())
    if original is None:
        text_prices = _prices_from_text(node.text())
        if current is None:
            return text_prices
        if text_prices[0] and text_prices[0] > current:
            original = text_prices[0]
    return original, current


def _is_internal(url: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower()
    allowed = (TARGET_HOST or "").lower()
    if host and allowed and host != allowed:
        return False
    path = parsed.path or ""
    lowered = url.lower()
    if any(part in lowered for part in SKIP_PATH_PARTS):
        return False
    if parsed.query and any(key in parsed.query.lower() for key in ("page=", "filter", "sort_by", "source=")):
        return False
    return path.startswith("/") or not parsed.netloc


def _clean_url(url: str) -> str:
    parsed = urlparse(url)
    scheme = parsed.scheme or "https"
    netloc = parsed.netloc or urlparse(BASE_URL).netloc
    path = parsed.path or "/"
    return urlunparse((scheme, netloc, path.rstrip("/") or "/", "", "", ""))
