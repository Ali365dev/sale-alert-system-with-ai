"""Tests for services/website_scraper/closure_detector.py — the missing-count
state machine that closes website offers. No real DB (see conftest.py): each
test builds plain Offer instances and a MagicMock session whose
`.query(Offer).filter(...).all()` returns them directly.

Covers every signal in the module's own docstring:
  1. re-matched this run -> left alone (already reset by offer_processor)
  2. source_url gone (404/410) or expiry_date passed -> immediate EXPIRED
  3. source_url fetched OK but not matched -> missing_count++, threshold escalation
  4. source_url not part of this run (unvisited/blocked/failed) -> untouched
"""
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from database.models import Offer
from services.website_scraper import closure_detector

BRAND = "Acme"


def make_offer(
    id: int,
    *,
    closure_status: str = "ACTIVE",
    missing_count: int = 0,
    source_url: str = "https://acme.example/collections/sale",
    expiry_date=None,
    is_active: bool = True,
) -> Offer:
    return Offer(
        id=id,
        brand=BRAND,
        source="website",
        source_url=source_url,
        website=source_url,
        closure_status=closure_status,
        missing_count=missing_count,
        expiry_date=expiry_date,
        is_active=is_active,
    )


def session_with(*offers: Offer) -> MagicMock:
    session = MagicMock()
    session.query.return_value.filter.return_value.all.return_value = list(offers)
    return session


def test_rematched_offer_is_left_alone():
    """Test 1 — offer_processor already reset it; apply() must not touch it again."""
    offer = make_offer(1, closure_status="ACTIVE", missing_count=0)
    session = session_with(offer)

    closure_detector.apply(
        session, BRAND, fetched_ok_urls={offer.source_url}, fetched_gone_urls=set(), matched_offer_ids={1},
    )

    assert offer.missing_count == 0
    assert offer.closure_status == "ACTIVE"
    assert offer.is_active is True


def test_first_successful_miss_increments_but_stays_active():
    """Test 2."""
    offer = make_offer(2, closure_status="ACTIVE", missing_count=0)
    session = session_with(offer)

    closure_detector.apply(
        session, BRAND, fetched_ok_urls={offer.source_url}, fetched_gone_urls=set(), matched_offer_ids=set(),
    )

    assert offer.missing_count == 1
    assert offer.closure_status == "ACTIVE"
    assert offer.is_active is True


def test_second_successful_miss_becomes_possibly_ended():
    """Test 3."""
    offer = make_offer(3, closure_status="ACTIVE", missing_count=1)
    session = session_with(offer)

    closure_detector.apply(
        session, BRAND, fetched_ok_urls={offer.source_url}, fetched_gone_urls=set(), matched_offer_ids=set(),
    )

    assert offer.missing_count == 2
    assert offer.closure_status == "POSSIBLY_ENDED"
    assert offer.is_active is True


def test_third_successful_miss_expires():
    """Test 4."""
    offer = make_offer(4, closure_status="POSSIBLY_ENDED", missing_count=2)
    session = session_with(offer)

    closure_detector.apply(
        session, BRAND, fetched_ok_urls={offer.source_url}, fetched_gone_urls=set(), matched_offer_ids=set(),
    )

    assert offer.missing_count == 3
    assert offer.closure_status == "EXPIRED"
    assert offer.is_active is False


def test_404_expires_immediately_regardless_of_missing_count():
    """Test 5."""
    offer = make_offer(5, closure_status="ACTIVE", missing_count=1)
    session = session_with(offer)

    closure_detector.apply(
        session, BRAND, fetched_ok_urls=set(), fetched_gone_urls={offer.source_url}, matched_offer_ids=set(),
    )

    assert offer.closure_status == "EXPIRED"
    assert offer.is_active is False


def test_410_expires_immediately_same_as_404():
    """Test 6 — finalize_brand_scrape merges 404 and 410 into one
    fetched_gone_urls set, so from closure_detector's side this is identical
    to the 404 case; asserted separately per the spec's own test list."""
    offer = make_offer(6, closure_status="POSSIBLY_ENDED", missing_count=2)
    session = session_with(offer)

    closure_detector.apply(
        session, BRAND, fetched_ok_urls=set(), fetched_gone_urls={offer.source_url}, matched_offer_ids=set(),
    )

    assert offer.closure_status == "EXPIRED"
    assert offer.is_active is False


def test_expiry_date_passed_expires_immediately_even_if_unvisited():
    """Test 7 — expiry_date alone is enough, independent of this run's fetch
    outcome (the offer's URL isn't in either set here)."""
    offer = make_offer(
        7, closure_status="ACTIVE", missing_count=0,
        expiry_date=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1),
    )
    session = session_with(offer)

    closure_detector.apply(
        session, BRAND, fetched_ok_urls=set(), fetched_gone_urls=set(), matched_offer_ids=set(),
    )

    assert offer.closure_status == "EXPIRED"
    assert offer.is_active is False


def test_unvisited_url_is_left_completely_unchanged():
    """Test 8 — url wasn't discovered/ranked/reached this run at all."""
    offer = make_offer(8, closure_status="ACTIVE", missing_count=1)
    session = session_with(offer)

    closure_detector.apply(
        session, BRAND,
        fetched_ok_urls={"https://acme.example/collections/other-page"},
        fetched_gone_urls=set(),
        matched_offer_ids=set(),
    )

    assert offer.missing_count == 1
    assert offer.closure_status == "ACTIVE"
    assert offer.is_active is True


def test_blocked_page_is_indistinguishable_from_unvisited():
    """Test 9 — a 403/blocked fetch never enters fetched_ok_urls or
    fetched_gone_urls in the first place (services.py's finalize_brand_scrape
    only adds http_status < 400 to fetched_ok and 404/410 to fetched_gone),
    so from closure_detector's perspective it's the same "say nothing" case
    as an unvisited URL — this asserts that invariant directly."""
    offer = make_offer(9, closure_status="ACTIVE", missing_count=0)
    session = session_with(offer)

    closure_detector.apply(
        session, BRAND, fetched_ok_urls=set(), fetched_gone_urls=set(), matched_offer_ids=set(),
    )

    assert offer.missing_count == 0
    assert offer.closure_status == "ACTIVE"
    assert offer.is_active is True


def test_network_error_page_is_indistinguishable_from_unvisited():
    """Test 10 — same reasoning as the blocked case: a raised exception in
    process_page saves http_status=None, which finalize_brand_scrape's
    `r.http_status and r.http_status < 400` filter excludes from both sets."""
    offer = make_offer(10, closure_status="ACTIVE", missing_count=2)
    session = session_with(offer)

    closure_detector.apply(
        session, BRAND, fetched_ok_urls=set(), fetched_gone_urls=set(), matched_offer_ids=set(),
    )

    assert offer.missing_count == 2
    assert offer.closure_status == "ACTIVE"
    assert offer.is_active is True


def test_never_produces_manually_closed():
    """Test 12 — closure_detector must never set MANUALLY_CLOSED; that value
    only ever comes from the explicit admin action, close_manually()."""
    offers = [
        make_offer(20, closure_status="ACTIVE", missing_count=1),
        make_offer(21, closure_status="POSSIBLY_ENDED", missing_count=2),
        make_offer(22, closure_status="ACTIVE", source_url="https://acme.example/gone"),
    ]
    session = session_with(*offers)

    closure_detector.apply(
        session, BRAND,
        fetched_ok_urls={offers[0].source_url, offers[1].source_url},
        fetched_gone_urls={offers[2].source_url},
        matched_offer_ids=set(),
    )

    assert all(o.closure_status != "MANUALLY_CLOSED" for o in offers)


def test_close_manually_sets_manually_closed():
    """close_manually() is the only path that may produce MANUALLY_CLOSED."""
    offer = make_offer(23, closure_status="ACTIVE")
    closure_detector.close_manually(MagicMock(), offer)
    assert offer.closure_status == "MANUALLY_CLOSED"
    assert offer.is_active is False


def test_multiple_offers_are_evaluated_independently():
    """Test 13."""
    matched = make_offer(30, closure_status="ACTIVE", missing_count=0, source_url="https://acme.example/a")
    missed = make_offer(31, closure_status="ACTIVE", missing_count=0, source_url="https://acme.example/b")
    unvisited = make_offer(32, closure_status="ACTIVE", missing_count=0, source_url="https://acme.example/c")
    gone = make_offer(33, closure_status="ACTIVE", missing_count=0, source_url="https://acme.example/d")
    session = session_with(matched, missed, unvisited, gone)

    closure_detector.apply(
        session, BRAND,
        fetched_ok_urls={matched.source_url, missed.source_url},
        fetched_gone_urls={gone.source_url},
        matched_offer_ids={matched.id},
    )

    assert matched.missing_count == 0 and matched.closure_status == "ACTIVE"
    assert missed.missing_count == 1 and missed.closure_status == "ACTIVE"
    assert unvisited.missing_count == 0 and unvisited.closure_status == "ACTIVE"
    assert gone.closure_status == "EXPIRED" and gone.is_active is False


def test_url_normalization_matches_trailing_slash_and_query_variants():
    """Regression for the URL-matching gap: an offer's stored source_url
    (no trailing slash) must still match this run's fetched_ok_urls entry
    even if the crawler's resolved final_url has a trailing slash or a
    tracking query string — both get canonicalized through the same
    extractor.clean_url the crawler already uses for discovery, not a second
    competing normalizer."""
    offer = make_offer(40, closure_status="ACTIVE", missing_count=1, source_url="https://acme.example/collections/sale")
    session = session_with(offer)

    closure_detector.apply(
        session, BRAND,
        fetched_ok_urls={"https://acme.example/collections/sale/?utm_source=newsletter"},
        fetched_gone_urls=set(),
        matched_offer_ids=set(),
    )

    assert offer.missing_count == 2
    assert offer.closure_status == "POSSIBLY_ENDED"


def test_brand_with_no_offers_returns_zero_counts():
    session = session_with()
    counts = closure_detector.apply(
        session, BRAND, fetched_ok_urls=set(), fetched_gone_urls=set(), matched_offer_ids=set(),
    )
    assert counts == {"expired": 0, "possibly_ended": 0, "reactivated": 0}


def test_none_brand_name_is_a_no_op():
    """Ad-hoc URL scrapes (no brand_id) must never run closure detection."""
    session = MagicMock()
    counts = closure_detector.apply(
        session, None, fetched_ok_urls=set(), fetched_gone_urls=set(), matched_offer_ids=set(),
    )
    assert counts == {"expired": 0, "possibly_ended": 0, "reactivated": 0}
    session.query.assert_not_called()
