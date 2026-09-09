"""Selectolax-based HTML extraction + JSON-LD/structured-data extraction.
Ported from the validated research spike at repo-root `website_scraper/`
(extractors/html_page.py, extractors/structured_data.py) — same selectors and
price-parsing logic, generalized from one hardcoded site to any brand's URL/
host passed in per call."""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import urljoin, urlparse, urlunparse

from services.website_scraper.models import PriceInfo, RawPage

_PRICE_RE = re.compile(
    r"(?:rs\.?|pkr|₨|usd|eur|gbp|\$|€|£)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)",
    re.I,
)
_AMOUNT_FIND_RE = re.compile(
    r"(?:Rs\.?|PKR|₨|USD|EUR|GBP|\$|€|£)\s*[\d,]+(?:\.\d{1,2})?",
    re.I,
)

_SKIP_PATH_PARTS = (
    "/cart", "/checkout", "/checkouts", "/account", "/admin", "/orders", "/cdn/",
    "/policies", "/wishlist", "/login", "/on/demandware.store/", "/on/demandware.static/",
    "javascript:", "mailto:", "tel:",
)


def parse_money(text: str | None) -> float | None:
    if not text:
        return None
    match = _PRICE_RE.search(text.replace("\xa0", " "))
    if not match:
        return None
    raw = match.group(1).replace(",", "")
    try:
        return float(raw)
    except ValueError:
        return None


def _prices_from_text(text: str) -> tuple[float | None, float | None]:
    amounts = [parse_money(m.group(0)) for m in _AMOUNT_FIND_RE.finditer(text or "")]
    amounts = [a for a in amounts if a is not None and a >= 20]
    if not amounts:
        return None, None
    if len(amounts) == 1:
        return None, amounts[0]
    high, low = max(amounts), min(amounts)
    return (high, low) if high > low else (None, low)


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


def is_internal(url: str, target_host: str) -> bool:
    parsed = urlparse(url)
    host = (parsed.netloc or "").lower()
    if host and target_host and host != target_host.lower():
        return False
    lowered = url.lower()
    if any(part in lowered for part in _SKIP_PATH_PARTS):
        return False
    if parsed.query and any(key in parsed.query.lower() for key in ("page=", "filter", "sort_by", "source=")):
        return False
    return (parsed.path or "").startswith("/") or not parsed.netloc


def clean_url(url: str, fallback_netloc: str) -> str:
    parsed = urlparse(url)
    scheme = parsed.scheme or "https"
    netloc = parsed.netloc or fallback_netloc
    path = parsed.path or "/"
    return urlunparse((scheme, netloc, path.rstrip("/") or "/", "", "", ""))


def is_product_url(url: str) -> bool:
    path = urlparse(url).path.lower()
    if "/products/" in path:
        return True
    return path.endswith(".html") and "shopthelook" not in path


def extract_visible_text(html: str, *, limit: int = 12000) -> str:
    from selectolax.parser import HTMLParser

    tree = HTMLParser(html)
    for node in tree.css("script, style, noscript"):
        node.decompose()
    text = tree.body.text(separator=" ") if tree.body else tree.text()
    return re.sub(r"\s+", " ", text or "").strip()[:limit]


def extract_links(html: str, page_url: str, target_host: str) -> list[str]:
    from selectolax.parser import HTMLParser

    tree = HTMLParser(html)
    found: list[str] = []
    seen: set[str] = set()
    for node in tree.css("a[href]"):
        href = (node.attributes.get("href") or "").strip()
        if not href:
            continue
        absolute = clean_url(urljoin(page_url, href), target_host)
        if not is_internal(absolute, target_host) or absolute in seen:
            continue
        seen.add(absolute)
        found.append(absolute)
    return found


def extract_images(html: str, page_url: str) -> tuple[list[str], list[str]]:
    from selectolax.parser import HTMLParser

    tree = HTMLParser(html)
    images: list[str] = []
    alts: list[str] = []
    for node in tree.css("img[src]"):
        src = (node.attributes.get("src") or "").strip()
        if not src or src.startswith("data:"):
            continue
        images.append(urljoin(page_url, src))
        alt = (node.attributes.get("alt") or "").strip()
        if alt:
            alts.append(alt)
        if len(images) >= 30:
            break
    return images, alts


def _name_from_alt(alt: str) -> str | None:
    parts = [p.strip() for p in (alt or "").split("|") if p.strip()]
    named = [p for p in parts if not re.match(r"^(?:rs\.?|pkr)", p, re.I)]
    if len(named) >= 2:
        return named[-1]
    return named[0] if named else None


def extract_products(html: str, page_url: str, target_host: str) -> list[dict[str, Any]]:
    """Shopify (.t4s-product-info) and Salesforce Commerce (.product-tile)
    product-card selectors, plus a PDP fallback — validated against real
    storefronts (sokamal.com, pk.khaadi.com) in the research spike."""
    from selectolax.parser import HTMLParser

    tree = HTMLParser(html)
    products: list[dict[str, Any]] = []
    seen: set[str] = set()

    def add(name, url, original, current) -> None:
        if not name and current is None:
            return
        if url in seen:
            return
        seen.add(url)
        products.append({"name": name, "current_price": current, "original_price": original, "url": url})

    for info in tree.css(".t4s-product-info"):
        title_a = info.css_first(".t4s-product-title a") or info.css_first("a[href*='/products/']")
        price_el = info.css_first(".t4s-product-price")
        name = title_a.text(strip=True) if title_a else None
        href = title_a.attributes.get("href") if title_a else None
        url = clean_url(urljoin(page_url, href), target_host) if href else page_url
        original, current = _prices_from_price_node(price_el)
        add(name, url, original, current)

    for tile in tree.css(".product-tile"):
        link = tile.css_first("a.plpRedirectPdp") or tile.css_first("a[href*='.html']") or tile.css_first("a[href]")
        href = link.attributes.get("href") if link else None
        url = clean_url(urljoin(page_url, href), target_host) if href else page_url
        img = tile.css_first("img.tile-image") or tile.css_first("img")
        alt = (img.attributes.get("alt") if img else "") or ""
        name = _name_from_alt(alt) or (link.text(strip=True) if link else None)
        original, current = _prices_from_text(tile.text())
        if current is None:
            original, current = _prices_from_text(alt)
        add(name, url, original, current)

    for card in tree.css('[data-testid="product-card-main"]'):
        link = card.css_first("a[href]")
        href = link.attributes.get("href") if link else None
        url = clean_url(urljoin(page_url, href), target_host) if href else page_url
        title = card.css_first("h4") or card.css_first('[class*="product-card-content-main__name"]')
        img = card.css_first("img[alt]")
        name = (title.text(strip=True) if title else None) or (img.attributes.get("alt") if img else None)
        orig_el = card.css_first('[data-testid="original-price"]') or card.css_first('[data-testid="crossed-price"]')
        original = parse_money(orig_el.text() if orig_el else None)
        current_el = card.css_first('[data-testid="main-price"]') or card.css_first('[data-testid="price-component"]')
        current = parse_money(current_el.text() if current_el else None)
        if current is None:
            original, current = _prices_from_text(card.text())
        add(name, url, original, current)

    if is_product_url(page_url) and clean_url(page_url, target_host) not in seen:
        title = tree.css_first("h1")
        price_el = (
            tree.css_first(".t4s-product-price") or tree.css_first(".price__sale")
            or tree.css_first(".t4s-price") or tree.css_first(".prices") or tree.css_first(".product-price")
        )
        original, current = _prices_from_price_node(price_el)
        if current is None:
            original, current = _prices_from_text(tree.body.text() if tree.body else "")
        add(title.text(strip=True) if title else None, clean_url(page_url, target_host), original, current)

    return products


def extract_page(html: str, url: str, final_url: str, http_status: int, target_host: str) -> RawPage:
    """Assembles a RawPage: title/meta/canonical, visible text, images,
    products/prices, discounts, promo codes, internal links."""
    from selectolax.parser import HTMLParser

    tree = HTMLParser(html)
    title_node = tree.css_first("title")
    og_title = tree.css_first('meta[property="og:title"]')
    meta_desc = tree.css_first('meta[name="description"]') or tree.css_first('meta[property="og:description"]')
    canonical_node = tree.css_first('link[rel="canonical"]')

    page_title = (og_title.attributes.get("content") if og_title else None) or (
        title_node.text(strip=True) if title_node else None
    )
    meta_description = meta_desc.attributes.get("content") if meta_desc else None
    canonical_url = canonical_node.attributes.get("href") if canonical_node else None

    body_text = extract_visible_text(html)
    headline_nodes = tree.css("h1, h2, h3")
    headline_text = " | ".join(n.text(strip=True) for n in headline_nodes[:10] if n.text(strip=True))

    images, alts = extract_images(html, final_url or url)
    links = extract_links(html, final_url or url, target_host)
    products = extract_products(html, final_url or url, target_host)

    structured = extract_structured(html, final_url or url)
    for product in structured.get("products") or []:
        products.append(product)

    prices = [
        PriceInfo(original=p.get("original_price"), current=p.get("current_price"))
        for p in products
        if p.get("current_price") is not None
    ]
    discounts = [
        round(((p.original - p.current) / p.original) * 100.0, 1)
        for p in prices
        if p.original and p.current and p.original > p.current
    ]
    promo_codes = [
        m.group(0)
        for m in re.finditer(r"(?:promo code|coupon code)\s*[:\s]*([A-Z0-9\-]{3,20})", body_text, re.I)
    ][:10]

    return RawPage(
        url=url,
        final_url=final_url or url,
        http_status=http_status,
        html=html,
        page_title=page_title,
        meta_description=meta_description,
        canonical_url=canonical_url,
        headline_text=headline_text,
        body_text=body_text,
        images=images[:20],
        image_alt_text=alts[:20],
        detected_prices=prices[:30],
        discount_percentages=discounts[:30],
        coupon_codes=promo_codes,
        links=links[:50],
    )


def extract_structured(html: str, url: str) -> dict[str, Any]:
    """JSON-LD / microdata / OpenGraph via extruct — schema.org Product/Offer."""
    try:
        import extruct
    except ImportError as exc:
        return {"found": False, "error": str(exc), "products": []}

    try:
        data = extruct.extract(html, base_url=url, syntaxes=["json-ld", "microdata", "opengraph"])
    except Exception as exc:
        return {"found": False, "error": f"{type(exc).__name__}: {exc}", "products": []}

    products: list[dict[str, Any]] = []
    types: list[str] = []
    for items in (data or {}).values():
        if not isinstance(items, list):
            continue
        for item in items:
            if isinstance(item, dict):
                types.extend(_collect_types(item))
                products.extend(_products_from_node(item, url))

    found = any(t.lower() in {"product", "offer", "aggregateoffer"} for t in types) or bool(products)
    return {"found": found, "products": products}


def _collect_types(node: Any) -> list[str]:
    found: list[str] = []
    if not isinstance(node, dict):
        return found
    raw = node.get("@type") or node.get("type")
    if isinstance(raw, str):
        found.append(raw.split("/")[-1])
    elif isinstance(raw, list):
        found.extend(str(i).split("/")[-1] for i in raw)
    for value in node.values():
        if isinstance(value, dict):
            found.extend(_collect_types(value))
        elif isinstance(value, list):
            for item in value:
                found.extend(_collect_types(item))
    return found


def _products_from_node(node: dict[str, Any], page_url: str) -> list[dict[str, Any]]:
    types = node.get("@type") or node.get("type") or ""
    type_text = " ".join(types) if isinstance(types, list) else str(types)
    out: list[dict[str, Any]] = []
    if "product" in type_text.lower():
        out.append(_product_from_schema(node, page_url))
    offers = node.get("offers")
    if isinstance(offers, dict) and "offer" in str(offers.get("@type") or "").lower() and not out:
        out.append(_product_from_schema({"name": node.get("name"), "url": node.get("url"), "offers": offers}, page_url))
    graph = node.get("@graph")
    if isinstance(graph, list):
        for item in graph:
            if isinstance(item, dict):
                out.extend(_products_from_node(item, page_url))
    return [p for p in out if p.get("name") or p.get("current_price") is not None]


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return None


def _product_from_schema(node: dict[str, Any], page_url: str) -> dict[str, Any]:
    offers = node.get("offers")
    offer = offers[0] if isinstance(offers, list) and offers else offers if isinstance(offers, dict) else {}
    if not isinstance(offer, dict):
        offer = {}
    url = node.get("url") or offer.get("url") or page_url
    if isinstance(url, str) and url.startswith("/"):
        url = urljoin(page_url, url)
    return {
        "name": node.get("name") or offer.get("name"),
        "current_price": _number(offer.get("price") or offer.get("lowPrice") or node.get("price")),
        "original_price": _number(offer.get("highPrice") or node.get("compare_at_price")),
        "url": url,
        "currency": offer.get("priceCurrency") or node.get("priceCurrency"),
    }
