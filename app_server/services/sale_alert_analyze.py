"""Fetch a product page and extract name/brand/price/image for sale alerts."""
from __future__ import annotations

import json
import re
from urllib.parse import unquote, urljoin, urlparse

from selectolax.lexbor import LexborHTMLParser as HTMLParser

from services.sale_alert_matching import discount_pct
from services.website_scraper import crawler
from services.website_scraper.extractor import clean_url, extract_page, extract_products, extract_structured

_ASSET_EXT = re.compile(r"\.(?:svg|ico|gif)(?:\?|$)", re.I)
_RASTER_IMG = re.compile(
    r"https?://[^\s\"'<>]+?\.(?:jpe?g|png|webp)(?:\?[^\s\"'<>]*)?",
    re.I,
)


def _meta_from_html(html: str, base_url: str) -> tuple[str | None, str | None]:
    tree = HTMLParser(html)
    site = tree.css_first('meta[property="og:site_name"]')
    brand = (site.attributes.get("content") if site else None) or None
    brand = brand.strip() if brand else None
    og_img = tree.css_first('meta[property="og:image"]')
    img = og_img.attributes.get("content") if og_img else None
    if img and img.startswith("/"):
        img = urljoin(base_url, img)
    return brand, img


def brand_from_host(host: str) -> str | None:
    host = (host or "").lower().removeprefix("www.")
    if not host:
        return None
    label = host.split(".")[0]
    if not label or label in {"shop", "store", "www", "m", "cdn"}:
        return None
    return label.replace("-", " ").title()


def _product_handle(url: str) -> str | None:
    path = unquote(urlparse(url).path or "").rstrip("/")
    parts = [p for p in path.split("/") if p]
    if not parts:
        return None
    if "products" in parts:
        i = parts.index("products")
        if i + 1 < len(parts):
            return parts[i + 1]
    return parts[-1]


def _shopify_width(url: str) -> int:
    m = re.search(r"[?&]width=(\d+)", url, flags=re.I)
    return int(m.group(1)) if m else 0


def normalize_image_url(url: str | None) -> str | None:
    """Make CDN URLs mobile-friendly (https, no html entities, usable Shopify size)."""
    if not url or not isinstance(url, str):
        return None
    url = url.strip().replace("&amp;", "&")
    if not url:
        return None
    if url.startswith("//"):
        url = "https:" + url
    if not url.startswith(("http://", "https://")):
        return None
    if _ASSET_EXT.search(url):
        return None
    # Shopify srcset often starts at width=100 — bump to a displayable size for the app.
    if "cdn.shopify.com" in url.lower():
        base = url.split("?")[0]
        # Drop tiny crop params; keep cache-buster `v=` when present.
        v = re.search(r"[?&]v=([^&]+)", url)
        qs = ["width=800"]
        if v:
            qs.append(f"v={v.group(1)}")
        url = f"{base}?{'&'.join(qs)}"
    return url


def pick_product_image(html: str, page_images: list[str], product_url: str, og_image: str | None) -> str | None:
    handle = (_product_handle(product_url) or "").lower()
    handle_key = re.sub(r"[^a-z0-9]+", "", handle)
    handle_compact = handle.replace("-", "").lower()

    candidates: list[str] = []
    if og_image and not _ASSET_EXT.search(og_image):
        candidates.append(og_image)
    for src in page_images or []:
        if src and not _ASSET_EXT.search(src):
            candidates.append(src)
    for m in _RASTER_IMG.findall(html or ""):
        candidates.append(m.replace("&amp;", "&"))

    # Prefer larger Shopify variants before normalizing (first raw hit is often width=100).
    candidates.sort(key=_shopify_width, reverse=True)

    seen: set[str] = set()
    ordered: list[str] = []
    for src in candidates:
        cleaned = normalize_image_url(src)
        if not cleaned:
            continue
        key = cleaned.split("?")[0].lower()
        if key in seen:
            continue
        seen.add(key)
        ordered.append(cleaned)

    def _match(src: str) -> bool:
        blob = re.sub(r"[^a-z0-9]+", "", src.lower())
        if handle_key and handle_key in blob:
            return True
        if handle_compact and handle_compact in blob:
            return True
        token = handle.split("-")[0] if handle else ""
        return bool(len(token) >= 6 and token.lower() in src.lower())

    if handle_key or handle_compact:
        for src in ordered:
            if _match(src):
                return src

    return ordered[0] if ordered else None


def friendly_fetch_error(status: int | None, *, blocked: bool = False) -> str:
    if status == 404:
        return "This page could not be found. Please verify the link and try again."
    if status in (403, 429) or blocked:
        return "This storefront blocked automated access. Please try again later, or enter the details manually."
    if status and status >= 400:
        return "This page could not be loaded. Please verify the link and try again."
    return "This page could not be loaded. Please check your connection and try again."


_SOURCE_RANK = {
    "schema": 0,
    "pdp_selector": 1,
    "pdp_region": 2,
    "card": 3,
    "embedded": 4,
    "body": 5,
}

# Shopify Storefront style (major currency units): "price":{"amount":"2490.0"}
_EMBEDDED_AMOUNT_RE = re.compile(
    r'"price"\s*:\s*\{\s*"amount"\s*:\s*"?(?P<amount>[0-9]+(?:\.[0-9]+)?)"?',
    re.I,
)
_EMBEDDED_COMPARE_AMOUNT_RE = re.compile(
    r'"compareAtPrice"\s*:\s*\{\s*"amount"\s*:\s*"?(?P<amount>[0-9]+(?:\.[0-9]+)?)"?',
    re.I,
)
# Shopify Liquid/JSON often stores money in subunits (cents): 249000 => Rs. 2,490
_SHOPIFY_CENTS_PRICE_RE = re.compile(r'"price"\s*:\s*(?P<cents>\d{4,})(?!\d)', re.I)
_SHOPIFY_CENTS_COMPARE_RE = re.compile(r'"compare_at_price"\s*:\s*(?P<cents>\d{4,})(?!\d)', re.I)
_DATA_SP_RE = re.compile(r'data-sp=["\']?(?P<cents>\d{4,})', re.I)
_DATA_SCP_RE = re.compile(r'data-scp=["\']?(?P<cents>\d{4,})', re.I)


def _product_choice_key(product: dict) -> tuple:
    source = (product.get("source") or "card").lower()
    cur = product.get("current_price")
    orig = product.get("original_price")
    has_pair = False
    absurd_pair = False
    try:
        if cur is not None and orig is not None:
            c, o = float(cur), float(orig)
            has_pair = o > c > 0
            # Mixed cents/major (e.g. 2490 vs 499000) — treat as weak until normalized.
            absurd_pair = has_pair and o >= c * 20
    except (TypeError, ValueError):
        pass
    return (
        1 if absurd_pair else 0,
        0 if has_pair else 1,
        _SOURCE_RANK.get(source, 9),
        0 if cur is not None else 1,
    )


def _cents_to_major(raw: str | float | None) -> float | None:
    """Convert Shopify subunit money (e.g. 249000) to major units (2490.0)."""
    if raw is None:
        return None
    try:
        cents = float(raw)
    except (TypeError, ValueError):
        return None
    if cents <= 0:
        return None
    # Shopify money is almost always integer cents ending in 00 for PKR whole rupees.
    if cents != int(cents):
        return cents
    return cents / 100.0


def _normalize_price_pair(
    current: float | None,
    original: float | None,
) -> tuple[float | None, float | None]:
    """Fix mixed major/subunit pairs that look like ~100% off (e.g. 2490 vs 499000)."""
    if current is None or original is None:
        return current, original
    try:
        cur = float(current)
        orig = float(original)
    except (TypeError, ValueError):
        return current, original
    if cur <= 0 or orig <= 0:
        return current, original

    # Original looks like cents while current is already major units.
    if orig >= cur * 20 and orig == int(orig) and int(orig) % 100 == 0:
        fixed = orig / 100.0
        if fixed > cur:
            orig = fixed

    # Current looks like cents while original is major (rarer).
    if cur >= orig * 20 and cur == int(cur) and int(cur) % 100 == 0:
        fixed = cur / 100.0
        if fixed > 0 and (orig is None or fixed <= orig):
            cur = fixed

    if orig <= cur:
        return cur, None
    return cur, orig


def _embedded_prices(html: str) -> tuple[float | None, float | None]:
    """Prefer major-unit amounts; fall back to Shopify cents (÷100)."""
    if not html:
        return None, None

    current = None
    original = None

    m = _EMBEDDED_AMOUNT_RE.search(html)
    if m:
        try:
            current = float(m.group("amount"))
        except (TypeError, ValueError):
            current = None

    m2 = _EMBEDDED_COMPARE_AMOUNT_RE.search(html)
    if m2:
        try:
            original = float(m2.group("amount"))
        except (TypeError, ValueError):
            original = None

    # Product JSON cents next — more specific than page-wide data-sp/scp (often related cards).
    if current is None:
        cp = _SHOPIFY_CENTS_PRICE_RE.search(html)
        if cp:
            current = _cents_to_major(cp.group("cents"))
    if original is None:
        cc = _SHOPIFY_CENTS_COMPARE_RE.search(html)
        if cc:
            original = _cents_to_major(cc.group("cents"))

    # Theme attrs last (first hit can be a related product).
    if current is None:
        sp = _DATA_SP_RE.search(html)
        if sp:
            current = _cents_to_major(sp.group("cents"))
    if original is None:
        scp = _DATA_SCP_RE.search(html)
        if scp:
            original = _cents_to_major(scp.group("cents"))

    current, original = _normalize_price_pair(current, original)
    # Callers unpack as (original, current).
    return original, current


def analyze_product_url(url: str) -> dict:
    url = (url or "").strip()
    if not url:
        return {"ok": False, "partial": False, "error": "A product link is required."}
    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    target_host = urlparse(url).netloc.lower()
    try:
        status, html, final_url, _used_browser = crawler.fetch_html_with_fallback(url)
    except Exception:
        return {
            "ok": False,
            "partial": False,
            "error": "This page could not be loaded. Please verify the link and try again.",
        }

    if status in (403, 429):
        return {"ok": False, "partial": False, "error": friendly_fetch_error(status, blocked=True)}
    if status in (404, 410) or status >= 400 or not html:
        return {"ok": False, "partial": False, "error": friendly_fetch_error(status)}

    final_url = final_url or url
    page = extract_page(html, url, final_url, status, target_host)
    products = extract_products(html, final_url, target_host)
    structured = extract_structured(html, final_url)
    for product in structured.get("products") or []:
        product.setdefault("source", "schema")
        products.append(product)

    emb_original, emb_current = _embedded_prices(html)
    if emb_current is not None:
        products.append(
            {
                "name": page.page_title,
                "current_price": emb_current,
                "original_price": emb_original,
                "url": final_url,
                "source": "embedded",
            }
        )

    normalized = clean_url(final_url, target_host)
    matching = [
        p for p in products if p.get("url") and clean_url(p["url"], target_host) == normalized
    ]
    pool = matching or products
    pool.sort(key=_product_choice_key)
    chosen = pool[0] if pool else None

    brand_name, og_image = _meta_from_html(html, final_url)
    if not brand_name:
        brand_name = brand_from_host(urlparse(final_url).netloc)

    product_name = (chosen or {}).get("name") or page.page_title
    current_price = (chosen or {}).get("current_price")
    original_price = (chosen or {}).get("original_price")

    # If a weak HTML guess won but schema/embedded disagree, trust the structured price.
    if matching:
        schema_hits = [
            p
            for p in matching
            if (p.get("source") or "").lower() in {"schema", "embedded"}
            and p.get("current_price") is not None
        ]
        if schema_hits and (chosen or {}).get("source") not in {"schema", "embedded", "pdp_selector"}:
            schema_hits.sort(key=_product_choice_key)
            best = schema_hits[0]
            current_price = best.get("current_price")
            if best.get("original_price") is not None:
                original_price = best.get("original_price")
            if best.get("name"):
                product_name = best.get("name")

    if current_price is None and emb_current is not None:
        current_price = emb_current
    if original_price is None and emb_original is not None:
        original_price = emb_original

    current_price, original_price = _normalize_price_pair(current_price, original_price)

    product_url = (chosen or {}).get("url") or page.canonical_url or final_url
    image_url = pick_product_image(html, page.images, product_url, og_image)

    sku = None
    tree = HTMLParser(html)
    for script in tree.css('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.text() or "")
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        for it in items:
            if isinstance(it, dict) and it.get("@type") == "Product" and it.get("sku"):
                sku = str(it["sku"]).strip() or None
                break
        if sku:
            break

    have_name = bool((product_name or "").strip())
    have_price = current_price is not None
    partial = have_name != have_price or (have_name and not brand_name) or not image_url

    if not have_name and not have_price:
        return {
            "ok": False,
            "partial": False,
            "error": "Product details were not found on this page. Please use a direct product link, or enter the details manually.",
        }

    pct = discount_pct(current_price, original_price)
    already_on_sale = pct is not None and pct > 0

    return {
        "ok": True,
        "partial": partial,
        "product_name": product_name,
        "brand_name": brand_name,
        "current_price": current_price,
        "original_price": original_price,
        "discount_pct": round(pct, 1) if pct is not None else None,
        "already_on_sale": already_on_sale,
        "image_url": image_url,
        "product_url": product_url,
        "sku": sku,
    }
