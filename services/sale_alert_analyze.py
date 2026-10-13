"""Fetch a product page and extract name/brand/price/image for sale alerts."""
from __future__ import annotations

import json
import re
from urllib.parse import unquote, urljoin, urlparse

from selectolax.parser import HTMLParser

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

    seen: set[str] = set()
    ordered: list[str] = []
    for src in candidates:
        key = src.split("?")[0]
        if key in seen:
            continue
        seen.add(key)
        ordered.append(src)

    if handle_key or handle_compact:
        for src in ordered:
            blob = re.sub(r"[^a-z0-9]+", "", src.lower())
            if handle_key and handle_key in blob:
                return src.split("&width=")[0].split("&amp;width=")[0]
            if handle_compact and handle_compact in blob:
                return src.split("&width=")[0].split("&amp;width=")[0]
            token = handle.split("-")[0] if handle else ""
            if len(token) >= 6 and token.lower() in src.lower():
                return src.split("&width=")[0].split("&amp;width=")[0]

    return ordered[0] if ordered else None


def friendly_fetch_error(status: int | None, *, blocked: bool = False) -> str:
    if status == 404:
        return "This page could not be found. Check the link and try again."
    if status in (403, 429) or blocked:
        return "This store blocked automated access. Try again later or enter details manually."
    if status and status >= 400:
        return "We couldn't load this page. Check the link and try again."
    return "We couldn't load this page. Check your connection and try again."


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
        return {"ok": False, "partial": False, "error": "We couldn't load this page. Check the link and try again."}

    if status in (403, 429):
        return {"ok": False, "partial": False, "error": friendly_fetch_error(status, blocked=True)}
    if status in (404, 410) or status >= 400 or not html:
        return {"ok": False, "partial": False, "error": friendly_fetch_error(status)}

    final_url = final_url or url
    page = extract_page(html, url, final_url, status, target_host)
    products = extract_products(html, final_url, target_host)
    structured = extract_structured(html, final_url)
    for product in structured.get("products") or []:
        products.append(product)

    normalized = clean_url(final_url, target_host)
    matching = [
        p for p in products if p.get("url") and clean_url(p["url"], target_host) == normalized
    ]
    matching.sort(
        key=lambda p: (
            0 if p.get("original_price") is not None and p.get("current_price") is not None else 1,
            0 if p.get("current_price") is not None else 1,
        )
    )
    chosen = matching[0] if matching else (products[0] if products else None)

    brand_name, og_image = _meta_from_html(html, final_url)
    if not brand_name:
        brand_name = brand_from_host(urlparse(final_url).netloc)

    product_name = (chosen or {}).get("name") or page.page_title
    current_price = (chosen or {}).get("current_price")
    original_price = (chosen or {}).get("original_price")
    if current_price is None and page.detected_prices:
        pi = page.detected_prices[0]
        current_price = pi.current
        original_price = original_price if original_price is not None else pi.original

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
            "error": "We couldn't find product details on this page. Try a direct product link or enter details manually.",
        }

    return {
        "ok": True,
        "partial": partial,
        "product_name": product_name,
        "brand_name": brand_name,
        "current_price": current_price,
        "original_price": original_price,
        "image_url": image_url,
        "product_url": product_url,
        "sku": sku,
    }
