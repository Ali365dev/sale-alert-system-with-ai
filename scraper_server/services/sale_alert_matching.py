"""Pure condition evaluation for product/brand sale alerts."""
from __future__ import annotations

from typing import Any

from services.offer_matching import normalize_name


def discount_pct(current: float | None, original: float | None) -> float | None:
    if current is None or original is None:
        return None
    try:
        cur = float(current)
        orig = float(original)
    except (TypeError, ValueError):
        return None
    if orig <= 0 or cur >= orig:
        return None
    return (1.0 - cur / orig) * 100.0


def _pct_threshold(condition_type: str, custom_pct: float | None) -> float | None:
    if condition_type == "pct_10":
        return 10.0
    if condition_type == "pct_20":
        return 20.0
    if condition_type == "pct_30":
        return 30.0
    if condition_type == "custom_pct":
        try:
            return float(custom_pct) if custom_pct is not None else None
        except (TypeError, ValueError):
            return None
    return None


def product_condition_met(
    condition_type: str,
    *,
    current_price: float | None,
    original_price: float | None,
    custom_pct: float | None = None,
    target_price: float | None = None,
    watch_below_price: float | None = None,
) -> bool:
    ct = (condition_type or "any_sale").strip()
    pct = discount_pct(current_price, original_price)

    if watch_below_price is not None:
        # "Wait for a better deal" — only fire after price drops below the create-time price.
        try:
            if current_price is None or float(current_price) >= float(watch_below_price):
                return False
        except (TypeError, ValueError):
            return False

    if ct == "any_sale":
        # Further drop alone counts when watch_below_price is set; otherwise need was/now.
        if watch_below_price is not None:
            return True
        return pct is not None and pct > 0

    threshold = _pct_threshold(ct, custom_pct)
    if threshold is not None:
        return pct is not None and pct + 1e-9 >= threshold

    if ct == "target_price":
        if current_price is None or target_price is None:
            return False
        try:
            return float(current_price) <= float(target_price)
        except (TypeError, ValueError):
            return False

    # Product alerts don't use brand-only conditions.
    if ct in {"new_promotion", "new_code"}:
        return pct is not None and pct > 0

    return False


def brand_condition_met(
    condition_type: str,
    *,
    alert_brand: str | None,
    offer_brand: str | None,
    discount_percentage: float | None = None,
    coupon_code: str | None = None,
    custom_pct: float | None = None,
) -> bool:
    if normalize_name(alert_brand) != normalize_name(offer_brand):
        return False
    if not normalize_name(alert_brand):
        return False

    ct = (condition_type or "any_sale").strip()
    discount = None
    if discount_percentage is not None:
        try:
            discount = float(discount_percentage)
        except (TypeError, ValueError):
            discount = None

    if ct == "any_sale":
        return True
    if ct == "new_promotion":
        return True
    if ct == "new_code":
        return bool((coupon_code or "").strip())

    threshold = _pct_threshold(ct, custom_pct)
    if threshold is not None:
        return discount is not None and discount + 1e-9 >= threshold

    # target_price is product-only
    return False


def _format_pkr(amount: float) -> str:
    try:
        n = int(round(float(amount)))
    except (TypeError, ValueError):
        return str(amount)
    return f"Rs. {n:,}"


def product_trigger_message(
    product_name: str | None,
    *,
    current_price: float | None,
    original_price: float | None,
) -> str:
    name = (product_name or "Your product").strip() or "Your product"
    pct = discount_pct(current_price, original_price)
    if pct is not None and current_price is not None and original_price is not None:
        return (
            f"{name} is now {int(round(pct))}% OFF "
            f"(Was: {_format_pkr(original_price)} Now: {_format_pkr(current_price)})"
        )
    if current_price is not None:
        return f"{name} dropped to {_format_pkr(current_price)}"
    return f"{name} matches your sale alert"


def brand_trigger_message(brand_name: str | None, offer: Any) -> str:
    brand = (brand_name or getattr(offer, "brand", None) or "Brand").strip() or "Brand"
    discount = getattr(offer, "discount_percentage", None)
    code = (getattr(offer, "coupon_code", None) or "").strip()
    title = (getattr(offer, "title", None) or getattr(offer, "summary", None) or "").strip()
    if discount is not None:
        msg = f"{brand}: up to {int(round(float(discount)))}% off"
    elif code:
        msg = f"{brand}: new discount code {code}"
    else:
        msg = f"{brand}: new sale or promotion"
    if title:
        msg = f"{msg} — {title[:120]}"
    return msg
