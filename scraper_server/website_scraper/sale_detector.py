"""Rule-based sale signals for the isolated website scrape lab. Not an AI detector."""
from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

_PRICE_RE = re.compile(
    r"(?:rs\.?|pkr|₨)\s*([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+(?:\.[0-9]{1,2})?)",
    re.I,
)

HEADLINE_PATTERNS = (
    re.compile(r"end of season sale(?:\s*[|]?\s*upto?\s*\d+\s*%\s*off)?", re.I),
    re.compile(r"upto?\s*\d+\s*%\s*off", re.I),
    re.compile(r"(?:flat|upto?)\s+\d+\s*%(?:\s*off)?", re.I),
    re.compile(r"\d+\s*%\s*off", re.I),
    re.compile(r"(?:buy one get one|bogo)(?:\s+\w+){0,4}", re.I),
    re.compile(r"(?:promo code|coupon code)\s*[:\s]*[A-Z0-9\-]+", re.I),
    re.compile(r"(?:clearance|limited time)\s+(?:sale|offer)?", re.I),
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


def maybe_shopify_cents(value: float | int | None) -> float | None:
    if value is None:
        return None
    number = float(value)
    if number >= 1000 and number % 100 == 0:
        return number / 100.0
    return number


def discount_percentage(original: float | None, current: float | None) -> float | None:
    if original is None or current is None:
        return None
    if original <= 0 or current <= 0 or original <= current:
        return None
    return round(((original - current) / original) * 100.0, 1)


def keyword_signals(text: str, url: str, *, limit: int = 8) -> list[dict[str, str]]:
    blob = re.sub(r"\s+", " ", text or "").strip()
    found: list[dict[str, str]] = []
    seen: set[str] = set()
    for pattern in HEADLINE_PATTERNS:
        for match in pattern.finditer(blob):
            snippet = re.sub(r"\s+", " ", match.group(0)).strip(" |")
            if len(snippet) < 5:
                continue
            key = snippet.lower()
            if key in seen:
                continue
            seen.add(key)
            found.append({"type": "headline", "text": snippet[:120], "url": url})
            if len(found) >= limit:
                return found
    return found


def is_sale_page(url: str) -> bool:
    path = urlparse(url or "").path.lower()
    return "/sale/" in path or path.rstrip("/").endswith("/sale") or "clearance" in path


def is_relevant_product(product: dict[str, Any]) -> bool:
    if product.get("discount_percentage"):
        return True
    original = product.get("original_price")
    current = product.get("current_price")
    if original and current and original > current:
        return True
    return is_sale_page(str(product.get("url") or ""))


def slim_product(product: dict[str, Any]) -> dict[str, Any]:
    return {
        "name": product.get("name"),
        "current_price": product.get("current_price"),
        "original_price": product.get("original_price"),
        "discount_percentage": product.get("discount_percentage"),
        "url": product.get("url"),
    }


def price_signal(product: dict[str, Any]) -> dict[str, Any] | None:
    original = product.get("original_price")
    current = product.get("current_price")
    pct = product.get("discount_percentage")
    if original is None or current is None or pct is None:
        return None
    if original <= current:
        return None
    return {
        "type": "price_drop",
        "text": f"{pct}% off ({original} → {current})",
        "url": product.get("url") or "",
    }


def enrich_product(product: dict[str, Any]) -> dict[str, Any]:
    original = product.get("original_price")
    current = product.get("current_price")
    if product.get("discount_percentage") is None:
        product["discount_percentage"] = discount_percentage(original, current)
    return product
