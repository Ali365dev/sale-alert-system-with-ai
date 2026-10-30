"""Resolve sale-alert brands against the catalog: logo fallback + demand signal."""
from __future__ import annotations

from urllib.parse import urlparse

from sqlalchemy import func

from database.db import get_session
from database.models import Brand, BrandRequest
from services.offer_matching import normalize_name

_SALE_ALERT_NOTE = "Detected from Sale Alert product analysis."


def _prefer_https(url: str | None) -> str | None:
    """Upgrade cleartext http:// so mobile clients (iOS ATS) can load the asset."""
    if not url:
        return None
    value = url.strip()
    if not value:
        return None
    if value.startswith("//"):
        return f"https:{value}"
    if value.startswith("http://"):
        return f"https://{value[7:]}"
    return value


def _host_from_url(url: str | None) -> str | None:
    if not url:
        return None
    host = (urlparse(url).netloc or "").lower().removeprefix("www.")
    return host or None


def find_matching_brand(
    session,
    brand_name: str | None,
    *,
    product_url: str | None = None,
) -> Brand | None:
    key = normalize_name(brand_name)
    if key:
        row = (
            session.query(Brand)
            .filter(Brand.is_active.is_(True), func.lower(Brand.name) == key)
            .first()
        )
        if row is not None:
            return row

    host = _host_from_url(product_url)
    if not host:
        return None

    candidates = (
        session.query(Brand)
        .filter(Brand.is_active.is_(True), Brand.website.isnot(None))
        .all()
    )
    for brand in candidates:
        site = (brand.website or "").lower()
        if host in site or site.removeprefix("https://").removeprefix("http://").removeprefix("www.").startswith(
            host
        ):
            return brand
    return None


def record_missing_brand_interest(
    session,
    brand_name: str,
    *,
    device_id: str | None = None,
    product_url: str | None = None,
) -> BrandRequest | None:
    """Upsert a pending BrandRequest so admins see demand for untracked brands."""
    name = (brand_name or "").strip()
    if not name:
        return None

    key = normalize_name(name)
    existing = (
        session.query(BrandRequest)
        .filter(
            BrandRequest.status == "pending",
            func.lower(BrandRequest.brand_name) == key,
        )
        .order_by(BrandRequest.created_at.desc())
        .first()
    )

    detail_bits = [_SALE_ALERT_NOTE]
    if product_url:
        detail_bits.append(f"Product URL: {product_url[:500]}")
    detail = "\n".join(detail_bits)

    if existing is not None:
        note = (existing.note or "").strip()
        if _SALE_ALERT_NOTE not in note:
            existing.note = f"{note}\n{detail}".strip() if note else detail
        elif product_url and product_url[:80] not in note:
            existing.note = f"{note}\nProduct URL: {product_url[:500]}".strip()
        if device_id and not existing.device_id:
            existing.device_id = device_id[:255]
        return existing

    row = BrandRequest(
        device_id=(device_id or "").strip()[:255] or None,
        brand_name=name[:255],
        category=None,
        note=detail,
        status="pending",
    )
    session.add(row)
    session.flush()
    return row


def enrich_analyze_with_brand(
    result: dict,
    *,
    device_id: str | None = None,
    record_missing: bool = True,
) -> dict:
    """Attach catalog logo when product image is missing; optionally log unknown brands."""
    if not result or not result.get("ok"):
        return result

    brand_name = (result.get("brand_name") or "").strip() or None
    product_url = (result.get("product_url") or "").strip() or None
    image_url = _prefer_https((result.get("image_url") or "").strip() or None)
    if image_url:
        result["image_url"] = image_url

    result.setdefault("brand_matched", False)
    result.setdefault("brand_logo_url", None)
    result.setdefault("brand_request_recorded", False)
    result.setdefault("image_from_brand_logo", False)

    if not brand_name and not product_url:
        return result

    with get_session() as session:
        brand = find_matching_brand(session, brand_name, product_url=product_url)
        if brand is not None:
            result["brand_matched"] = True
            if brand.name and not brand_name:
                result["brand_name"] = brand.name
            logo = _prefer_https((brand.logo_url or "").strip() or None)
            result["brand_logo_url"] = logo
            if not image_url and logo:
                result["image_url"] = logo
                result["image_from_brand_logo"] = True
                have_name = bool((result.get("product_name") or "").strip())
                have_price = result.get("current_price") is not None
                have_brand = bool((result.get("brand_name") or "").strip())
                result["partial"] = have_name != have_price or (have_name and not have_brand)
            return result

        if record_missing and brand_name:
            recorded = record_missing_brand_interest(
                session,
                brand_name,
                device_id=device_id,
                product_url=product_url,
            )
            result["brand_request_recorded"] = recorded is not None

    return result
