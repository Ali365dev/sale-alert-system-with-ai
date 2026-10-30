"""Strips volatile/boilerplate content and computes the two content hashes
that drive spec §13 (skip AI + offer creation when nothing actually
changed). `page_content_hash` is over the raw extracted text; the
`normalized_*` variant additionally drops session/tracking query params and
whitespace noise so a page that re-renders identically (different ad IDs,
timestamps in scripts, etc.) still hashes the same."""
from __future__ import annotations

import hashlib
import re

from services.website_scraper.models import RawPage

_WHITESPACE_RE = re.compile(r"\s+")
_TRACKING_PARAM_RE = re.compile(r"[?&](utm_[a-z]+|fbclid|gclid|ref|source)=[^&\s]*", re.I)


def normalize_text(text: str) -> str:
    text = _TRACKING_PARAM_RE.sub("", text or "")
    return _WHITESPACE_RE.sub(" ", text).strip().lower()


def _hash(*parts: str) -> str:
    blob = "␟".join(p or "" for p in parts)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


def page_content_hash(page: RawPage) -> str:
    return _hash(page.page_title or "", page.headline_text, page.body_text)


def normalized_content_hash(page: RawPage) -> str:
    normalized_body = normalize_text(page.headline_text + " " + page.body_text)
    prices = ",".join(
        f"{p.original}:{p.current}" for p in page.detected_prices if p.current is not None
    )
    discounts = ",".join(str(d) for d in sorted(page.discount_percentages))
    codes = ",".join(sorted(c.lower() for c in page.coupon_codes))
    return _hash(normalized_body, prices, discounts, codes)
