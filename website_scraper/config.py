"""Limits and target for the isolated website scrape lab."""
from __future__ import annotations

import os
from urllib.parse import urlparse

_DEFAULT_URL = "https://www.sokamal.com/"


def _normalize_base(url: str) -> str:
    text = (url or _DEFAULT_URL).strip()
    if not text:
        text = _DEFAULT_URL
    if not text.startswith("http"):
        text = "https://" + text
    return text.rstrip("/") + "/"


BASE_URL = _normalize_base(os.environ.get("WEBSITE_TARGET_URL") or _DEFAULT_URL)
TARGET_HOST = (urlparse(BASE_URL).netloc or "").lower()

MAX_PAGES = 6
REQUEST_TIMEOUT_SECONDS = 30.0
REQUEST_DELAY_SECONDS = 0.4
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
)

PRIORITY_TERMS = (
    "sale",
    "sales",
    "offer",
    "offers",
    "discount",
    "promotion",
    "promotions",
    "deal",
    "deals",
    "clearance",
    "collection",
    "collections",
    "product",
    "products",
    "shop",
)

SKIP_PATH_PARTS = (
    "/cart",
    "/checkout",
    "/checkouts",
    "/account",
    "/admin",
    "/orders",
    "/cdn/",
    "/policies",
    "/wishlist",
    "/login",
    "/on/demandware.store/",
    "/on/demandware.static/",
    "javascript:",
    "mailto:",
    "tel:",
)
