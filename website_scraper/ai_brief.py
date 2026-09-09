"""Tiny AI-facing summary. Do not send the full product list to an LLM."""
from __future__ import annotations

from collections import Counter
from typing import Any


def ai_brief(result: dict[str, Any], *, examples: int = 5) -> dict[str, Any]:
    products = [
        p
        for p in (result.get("products") or [])
        if isinstance(p, dict) and _usable(p)
    ]
    buckets: Counter[str] = Counter()
    currents: list[float] = []
    originals: list[float] = []
    for product in products:
        pct = product.get("discount_percentage")
        if pct is not None:
            buckets[f"{int(round(float(pct) / 10.0) * 10)}%"] += 1
        if product.get("current_price") is not None:
            currents.append(float(product["current_price"]))
        if product.get("original_price") is not None:
            originals.append(float(product["original_price"]))

    headlines = []
    seen = set()
    for signal in result.get("sale_signals") or []:
        text = (signal.get("text") or "").strip()
        key = text.lower()
        if not text or key in seen:
            continue
        seen.add(key)
        headlines.append(text)

    ranked = sorted(products, key=lambda p: float(p.get("discount_percentage") or 0), reverse=True)
    sample = [
        {
            "name": p.get("name"),
            "was": p.get("original_price"),
            "now": p.get("current_price"),
            "off": p.get("discount_percentage"),
        }
        for p in ranked[:examples]
    ]

    return {
        "site": result.get("url"),
        "status": result.get("status"),
        "pages_checked": result.get("pages_checked"),
        "headlines": headlines[:8],
        "discounted_items": len(products),
        "discount_buckets": dict(sorted(buckets.items(), key=lambda kv: kv[0])),
        "price_pkr": {
            "current_min": min(currents) if currents else None,
            "current_max": max(currents) if currents else None,
            "original_min": min(originals) if originals else None,
            "original_max": max(originals) if originals else None,
        },
        "examples": sample,
        "task": "Classify sale strength and whether this is worth alerting. Do not invent SKUs.",
    }


def _usable(product: dict[str, Any]) -> bool:
    name = (product.get("name") or "").lower()
    if "terms" in name or "condition" in name:
        return False
    current = product.get("current_price")
    original = product.get("original_price")
    pct = product.get("discount_percentage")
    if current is not None and float(current) < 200:
        return False
    if pct is not None and float(pct) >= 95:
        return False
    if original and current and float(original) <= float(current):
        return False
    return bool(pct or (original and current and float(original) > float(current)))
