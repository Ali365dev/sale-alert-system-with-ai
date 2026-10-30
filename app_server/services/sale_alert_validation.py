"""Shared request validation for Sale Alert create/update/analyze."""
from __future__ import annotations

from urllib.parse import urlparse

_ALERT_TYPES = frozenset({"product", "brand"})
_STATUSES = frozenset({"active", "paused", "triggered", "needs_attention"})
CHECK_FAIL_THRESHOLD = 3
_PRODUCT_CONDITIONS = frozenset({
    "any_sale", "pct_10", "pct_20", "pct_30", "custom_pct", "target_price",
})
_BRAND_CONDITIONS = frozenset({
    "any_sale", "pct_10", "pct_20", "pct_30", "new_promotion", "new_code",
})
_CONDITION_TYPES = _PRODUCT_CONDITIONS | _BRAND_CONDITIONS

MAX_DEVICE_ID = 128
MAX_NAME = 300
MAX_URL = 2000
MAX_SKU = 120


def is_http_url(value: str | None) -> bool:
    raw = (value or "").strip()
    if not raw or len(raw) > MAX_URL:
        return False
    candidate = raw if "://" in raw else f"https://{raw}"
    try:
        parsed = urlparse(candidate)
    except Exception:
        return False
    if parsed.scheme not in {"http", "https"}:
        return False
    host = (parsed.hostname or "").strip().lower()
    return bool(host and "." in host)


def normalize_http_url(value: str | None) -> str | None:
    raw = (value or "").strip()
    if not raw or not is_http_url(raw):
        return None
    return raw if "://" in raw else f"https://{raw}"


def _parse_optional_float(value, label: str) -> tuple[float | None, str | None]:
    if value is None or value == "":
        return None, None
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None, f"{label} must be a valid number"
    if n != n or n in (float("inf"), float("-inf")):  # NaN / inf
        return None, f"{label} must be a valid number"
    if n < 0:
        return None, f"{label} cannot be negative"
    return n, None


def validate_device_id(device_id: str | None) -> tuple[str | None, str | None]:
    device_id = (device_id or "").strip()
    if not device_id:
        return None, "device_id is required"
    if len(device_id) > MAX_DEVICE_ID:
        return None, "device_id is too long"
    return device_id, None


def validate_condition(
    alert_type: str,
    condition_type: str | None,
    *,
    custom_pct=None,
    target_price=None,
) -> tuple[dict | None, str | None]:
    ct = (condition_type or "any_sale").strip()
    allowed = _BRAND_CONDITIONS if alert_type == "brand" else _PRODUCT_CONDITIONS
    if ct not in allowed:
        return None, f"invalid condition_type for {alert_type} alert"

    if ct == "custom_pct":
        try:
            pct = float(custom_pct)
        except (TypeError, ValueError):
            return None, "custom_pct must be a number between 1 and 99"
        if pct != pct or pct < 1 or pct > 99:
            return None, "custom_pct must be a number between 1 and 99"
        return {"condition_type": ct, "custom_pct": pct, "target_price": None}, None

    if ct == "target_price":
        try:
            price = float(target_price)
        except (TypeError, ValueError):
            return None, "target_price must be greater than 0"
        if price != price or price <= 0:
            return None, "target_price must be greater than 0"
        return {"condition_type": ct, "custom_pct": None, "target_price": price}, None

    return {"condition_type": ct, "custom_pct": None, "target_price": None}, None


def validate_create_payload(body: dict) -> tuple[dict | None, str | None]:
    body = body or {}
    device_id, err = validate_device_id(body.get("device_id"))
    if err:
        return None, err

    alert_type = (body.get("alert_type") or "product").strip()
    if alert_type not in _ALERT_TYPES:
        return None, "alert_type must be 'product' or 'brand'"

    status = (body.get("status") or "active").strip()
    if status not in _STATUSES - {"needs_attention"}:
        return None, "status must be 'active', 'paused', or 'triggered'"

    condition, err = validate_condition(
        alert_type,
        body.get("condition_type"),
        custom_pct=body.get("custom_pct"),
        target_price=body.get("target_price"),
    )
    if err:
        return None, err

    product_name = (body.get("product_name") or "").strip() or None
    brand_name = (body.get("brand_name") or "").strip() or None
    product_url_raw = (body.get("product_url") or "").strip() or None
    image_url_raw = (body.get("image_url") or "").strip() or None
    sku = (body.get("sku") or "").strip() or None
    variant = (body.get("variant") or "").strip() or None

    if product_name and len(product_name) > MAX_NAME:
        return None, "product_name is too long"
    if brand_name and len(brand_name) > MAX_NAME:
        return None, "brand_name is too long"
    if sku and len(sku) > MAX_SKU:
        return None, "sku is too long"
    if variant and len(variant) > MAX_NAME:
        return None, "variant is too long"

    if alert_type == "product":
        if not product_name:
            return None, "product_name is required for product alerts"
        if not brand_name:
            return None, "brand_name is required for product alerts"
        if not product_url_raw:
            return None, "product_url is required for product alerts"
        if not is_http_url(product_url_raw):
            return None, "product_url must be a valid http(s) URL"
    else:
        if not brand_name:
            return None, "brand_name is required for brand alerts"
        if product_url_raw and not is_http_url(product_url_raw):
            return None, "product_url must be a valid http(s) URL"

    if image_url_raw and not is_http_url(image_url_raw):
        return None, "image_url must be a valid http(s) URL"

    current_price, err = _parse_optional_float(body.get("current_price"), "current_price")
    if err:
        return None, err
    original_price, err = _parse_optional_float(body.get("original_price"), "original_price")
    if err:
        return None, err
    if (
        current_price is not None
        and original_price is not None
        and original_price < current_price
    ):
        return None, "original_price should be greater than or equal to current_price"

    watch_below_price, err = _parse_optional_float(body.get("watch_below_price"), "watch_below_price")
    if err:
        return None, err
    if watch_below_price is not None and watch_below_price <= 0:
        return None, "watch_below_price must be greater than 0"

    notify_push = bool(body.get("notify_push")) if "notify_push" in body else True
    notify_email = bool(body.get("notify_email")) if "notify_email" in body else False
    notify_in_app = bool(body.get("notify_in_app")) if "notify_in_app" in body else True
    if not (notify_push or notify_email or notify_in_app):
        return None, "at least one notification method is required"

    return {
        "device_id": device_id,
        "alert_type": alert_type,
        "status": status,
        "product_name": product_name,
        "brand_name": brand_name,
        "product_url": normalize_http_url(product_url_raw) if product_url_raw else None,
        "image_url": normalize_http_url(image_url_raw) if image_url_raw else None,
        "current_price": current_price,
        "original_price": original_price,
        "sku": sku,
        "variant": variant,
        "condition_type": condition["condition_type"],
        "custom_pct": condition["custom_pct"],
        "target_price": condition["target_price"],
        "watch_below_price": watch_below_price,
        "notify_push": notify_push,
        "notify_email": notify_email,
        "notify_in_app": notify_in_app,
        "check_fail_count": 0,
        "last_check_error": None,
    }, None


def validate_patch_payload(body: dict, *, current_alert_type: str) -> tuple[dict | None, str | None]:
    body = body or {}
    patch: dict = {}

    if "status" in body:
        status = (body.get("status") or "").strip()
        if status not in _STATUSES:
            return None, "status must be 'active', 'paused', 'triggered', or 'needs_attention'"
        patch["status"] = status

    alert_type = current_alert_type
    if "alert_type" in body:
        alert_type = (body.get("alert_type") or "").strip()
        if alert_type not in _ALERT_TYPES:
            return None, "alert_type must be 'product' or 'brand'"
        patch["alert_type"] = alert_type

    if "condition_type" in body:
        condition, err = validate_condition(
            alert_type,
            body.get("condition_type"),
            custom_pct=body.get("custom_pct"),
            target_price=body.get("target_price"),
        )
        if err:
            return None, err
        patch["condition_type"] = condition["condition_type"]
        patch["custom_pct"] = condition["custom_pct"]
        patch["target_price"] = condition["target_price"]
    else:
        if "custom_pct" in body and body.get("custom_pct") is not None:
            try:
                pct = float(body.get("custom_pct"))
            except (TypeError, ValueError):
                return None, "custom_pct must be a number between 1 and 99"
            if pct != pct or pct < 1 or pct > 99:
                return None, "custom_pct must be a number between 1 and 99"
            patch["custom_pct"] = pct
        if "target_price" in body and body.get("target_price") is not None:
            try:
                price = float(body.get("target_price"))
            except (TypeError, ValueError):
                return None, "target_price must be greater than 0"
            if price != price or price <= 0:
                return None, "target_price must be greater than 0"
            patch["target_price"] = price

    for key in ("product_name", "brand_name", "sku", "variant"):
        if key not in body:
            continue
        val = body[key]
        if val is None:
            patch[key] = None
            continue
        text = str(val).strip() or None
        limit = MAX_SKU if key == "sku" else MAX_NAME
        if text and len(text) > limit:
            return None, f"{key} is too long"
        patch[key] = text

    for key in ("product_url", "image_url"):
        if key not in body:
            continue
        val = body[key]
        if val is None or str(val).strip() == "":
            patch[key] = None
            continue
        text = str(val).strip()
        if not is_http_url(text):
            return None, f"{key} must be a valid http(s) URL"
        patch[key] = normalize_http_url(text)

    for key, label in (
        ("current_price", "current_price"),
        ("original_price", "original_price"),
        ("watch_below_price", "watch_below_price"),
    ):
        if key not in body:
            continue
        parsed, err = _parse_optional_float(body.get(key), label)
        if err:
            return None, err
        if key == "watch_below_price" and parsed is not None and parsed <= 0:
            return None, "watch_below_price must be greater than 0"
        patch[key] = parsed

    cur = patch.get("current_price", body.get("current_price"))
    orig = patch.get("original_price", body.get("original_price"))
    if cur is not None and orig is not None:
        try:
            if float(orig) < float(cur):
                return None, "original_price should be greater than or equal to current_price"
        except (TypeError, ValueError):
            pass

    for key in ("notify_push", "notify_email", "notify_in_app"):
        if key in body:
            patch[key] = bool(body[key])

    if {"notify_push", "notify_email", "notify_in_app"} & set(body.keys()):
        # Only enforce when the client is explicitly setting notification flags.
        push = patch.get("notify_push", body.get("notify_push"))
        email = patch.get("notify_email", body.get("notify_email"))
        in_app = patch.get("notify_in_app", body.get("notify_in_app"))
        # If only one flag was patched, we can't know the others — skip unless all three present.
        if {"notify_push", "notify_email", "notify_in_app"}.issubset(body.keys()):
            if not (push or email or in_app):
                return None, "at least one notification method is required"

    return patch, None


# Re-export constants used by the router.
ALERT_TYPES = _ALERT_TYPES
STATUSES = _STATUSES
CONDITION_TYPES = _CONDITION_TYPES
