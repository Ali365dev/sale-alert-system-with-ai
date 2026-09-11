"""Sale closure detection (spec §14-15) — never deletes, never guesses past a
failed fetch. Three signals per open website offer, checked once per brand
scrape run (services.py calls `apply` after all pages for the brand have
been processed):

  1. Its source_url was re-scraped this run and offer_processor confirmed it
     again -> already reset by offer_processor (missing_count=0, ACTIVE).
  2. Its source_url was re-scraped this run and returned 404/410, or its
     end_date has passed -> immediate EXPIRED (explicit signal, spec §15).
  3. Its source_url was re-scraped this run (2xx) but no longer matched as a
     sale -> missing_count += 1, only on a *successful* scrape (spec §14 —
     "a failed HTTP request must not close an offer"). Escalates
     ACTIVE -> POSSIBLY_ENDED -> EXPIRED at the configured thresholds.
  4. Its source_url wasn't part of this run's discovered set at all -> left
     untouched; nothing can be concluded from a page that was never visited.

MANUALLY_CLOSED is only ever set by an explicit admin action (the API's
PATCH /offers/{id}/close), never by this module."""
from __future__ import annotations

from datetime import datetime
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from config import WEBSITE_MISSING_THRESHOLD_EXPIRED, WEBSITE_MISSING_THRESHOLD_POSSIBLY_ENDED
from database.models import Offer
from database.offer_retention import utcnow
from services.website_scraper.extractor import clean_url

_OPEN_STATUSES = ("ACTIVE", "POSSIBLY_ENDED")


def _normalize(url: str | None) -> str | None:
    """Same canonicalization crawler discovery already applies to every link
    it queues (extractor.clean_url — strips trailing slash/query/fragment,
    lowercases nothing else) so an offer's stored source_url compares equal
    to this run's fetched-URL sets even when a redirect or a stray trailing
    slash would otherwise make them differ as raw strings. Reused rather than
    reimplemented — see extractor.py's own definition."""
    if not url:
        return None
    return clean_url(url, urlparse(url).netloc)


def apply(
    session: Session,
    brand_name: str | None,
    *,
    fetched_ok_urls: set[str],
    fetched_gone_urls: set[str],
    matched_offer_ids: set[int],
) -> dict[str, int]:
    if brand_name is None:
        return {"expired": 0, "possibly_ended": 0, "reactivated": 0}

    now = utcnow()
    counts = {"expired": 0, "possibly_ended": 0, "reactivated": 0}

    fetched_ok_norm = {_normalize(u) for u in fetched_ok_urls}
    fetched_gone_norm = {_normalize(u) for u in fetched_gone_urls}

    offers = (
        session.query(Offer)
        .filter(Offer.source == "website", Offer.brand == brand_name, Offer.closure_status.in_(_OPEN_STATUSES))
        .all()
    )
    for offer in offers:
        if offer.id in matched_offer_ids:
            continue  # already confirmed + reset by offer_processor this run

        source_url = _normalize(offer.source_url or offer.website)
        if source_url in fetched_gone_norm or (offer.expiry_date and offer.expiry_date < now):
            offer.closure_status = "EXPIRED"
            offer.is_active = False
            counts["expired"] += 1
            continue

        if source_url not in fetched_ok_norm:
            continue  # not visited this run — can't conclude anything

        offer.missing_count = (offer.missing_count or 0) + 1
        if offer.missing_count >= WEBSITE_MISSING_THRESHOLD_EXPIRED:
            offer.closure_status = "EXPIRED"
            offer.is_active = False
            counts["expired"] += 1
        elif offer.missing_count >= WEBSITE_MISSING_THRESHOLD_POSSIBLY_ENDED:
            offer.closure_status = "POSSIBLY_ENDED"
            counts["possibly_ended"] += 1

    return counts


def close_manually(session: Session, offer: Offer) -> None:
    offer.closure_status = "MANUALLY_CLOSED"
    offer.is_active = False
