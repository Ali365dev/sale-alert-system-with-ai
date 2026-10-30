"""JSON-LD / microdata helpers for the isolated website scrape lab."""
from __future__ import annotations

from typing import Any
from urllib.parse import urljoin

from sale_detector import maybe_shopify_cents


def extract_structured(html: str, url: str) -> dict[str, Any]:
    try:
        import extruct
    except ImportError as exc:
        return {"found": False, "error": str(exc), "products": [], "raw_types": []}

    try:
        data = extruct.extract(
            html,
            base_url=url,
            syntaxes=["json-ld", "microdata", "opengraph"],
        )
    except Exception as extra:
        return {"found": False, "error": f"{type(extra).__name__}: {extra}", "products": [], "raw_types": []}

    products: list[dict[str, Any]] = []
    types: list[str] = []
    for syntax, items in (data or {}).items():
        if not isinstance(items, list):
            continue
        for item in items:
            if not isinstance(item, dict):
                continue
            types.extend(_collect_types(item))
            products.extend(_products_from_node(item, url))

    found = any(t.lower() in {"product", "offer", "aggregateoffer"} for t in types) or bool(products)
    return {"found": found, "error": None, "products": products, "raw_types": sorted(set(types))}


def _collect_types(node: Any) -> list[str]:
    found: list[str] = []
    if not isinstance(node, dict):
        return found
    raw = node.get("@type") or node.get("type")
    if isinstance(raw, str):
        found.append(raw.split("/")[-1])
    elif isinstance(raw, list):
        found.extend(str(item).split("/")[-1] for item in raw)
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
    if re_type_is(type_text, "Product"):
        out.append(_product_from_schema(node, page_url))
    offers = node.get("offers")
    if isinstance(offers, dict) and re_type_is(str(offers.get("@type") or ""), "Offer") and not out:
        out.append(_product_from_schema({"name": node.get("name"), "url": node.get("url"), "offers": offers}, page_url))
    graph = node.get("@graph")
    if isinstance(graph, list):
        for item in graph:
            if isinstance(item, dict):
                out.extend(_products_from_node(item, page_url))
    return [item for item in out if item.get("name") or item.get("current_price") is not None]


def re_type_is(type_text: str, wanted: str) -> bool:
    return wanted.lower() in type_text.lower()


def _product_from_schema(node: dict[str, Any], page_url: str) -> dict[str, Any]:
    offers = node.get("offers")
    offer = offers[0] if isinstance(offers, list) and offers else offers if isinstance(offers, dict) else {}
    if not isinstance(offer, dict):
        offer = {}
    url = node.get("url") or offer.get("url") or page_url
    if isinstance(url, str) and url.startswith("/"):
        url = urljoin(page_url, url)
    current = _number(offer.get("price") or offer.get("lowPrice") or node.get("price"))
    original = _number(offer.get("highPrice") or node.get("compare_at_price"))
    if current is not None and current >= 1000 and original is None:
        current = maybe_shopify_cents(current) or current
    elif current is not None and original is not None and current >= 1000 and original >= 1000:
        current = maybe_shopify_cents(current) or current
        original = maybe_shopify_cents(original) or original
    return {
        "name": node.get("name") or offer.get("name"),
        "current_price": current,
        "original_price": original,
        "discount_percentage": None,
        "url": url,
        "currency": offer.get("priceCurrency") or node.get("priceCurrency"),
        "availability": offer.get("availability"),
        "source": "json-ld",
    }


def _number(value: Any) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).replace(",", "").strip()
    try:
        return float(text)
    except ValueError:
        return None
