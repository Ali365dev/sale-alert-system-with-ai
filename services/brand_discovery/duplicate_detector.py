"""Duplicate-brand detection for a discovered brand — wraps the existing
domain/fuzzy-name check services/jobs/discover_brand.py already does for
BrandCandidate, and adds a social-profile-URL overlap check on top (per the
Brand Discovery spec's "duplicate detection based on: Brand name, Official
website domain, Social media profile URLs" requirement — the existing
function only covers the first two)."""
import json
from typing import Optional

from database.db import get_session
from database.models import Brand
from services.jobs.discover_brand import find_possible_duplicate


def _normalize_social_url(url: str) -> str:
    return (url or "").strip().rstrip("/").lower()


def _find_social_duplicate(social_links: dict) -> tuple[Optional[int], Optional[float], Optional[str]]:
    candidate_urls = {
        _normalize_social_url(entry.get("url", ""))
        for entry in (social_links or {}).values()
        if isinstance(entry, dict) and entry.get("url")
    }
    candidate_urls.discard("")
    if not candidate_urls:
        return None, None, None

    with get_session() as session:
        for b in session.query(Brand).all():
            if not b.social_links:
                continue
            try:
                existing_links = json.loads(b.social_links)
            except (json.JSONDecodeError, TypeError):
                continue
            existing_urls = {_normalize_social_url(v) for v in existing_links.values() if v}
            existing_urls.discard("")
            if candidate_urls & existing_urls:
                return b.id, 1.0, "social_link_match"

    return None, None, None


def find_brand_duplicate(
    name: Optional[str], website: Optional[str], social_links: Optional[dict]
) -> tuple[Optional[int], Optional[float], Optional[str]]:
    """Returns (brand_id, score, reason) — reason one of "domain_match" |
    "name_fuzzy_match" | "social_link_match" | None. Domain/name match is
    checked first (stronger signal, no network/extra query cost), social-URL
    overlap only if neither of those already found something."""
    brand_id, score, reason = find_possible_duplicate(name, website, sender_domain="")
    if brand_id is not None:
        return brand_id, score, reason

    return _find_social_duplicate(social_links or {})
