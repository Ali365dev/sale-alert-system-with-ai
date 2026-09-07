"""Tests for ai/sale_filter.py — the pre-AI sale-content relevance filter."""
import pytest

from ai.sale_filter import ELIGIBLE, NEEDS_REVIEW, NOT_SALE_RELATED, evaluate


@pytest.fixture(autouse=True)
def _use_built_in_keyword_defaults(mocker):
    # weak_keywords()/strong_keywords() read an admin-editable override via
    # services.settings_service.get_setting (see app/api/routers/settings.py's
    # /sale-filter endpoints) — never touch the real DB from these tests (see
    # tests/conftest.py). side_effect returns each call's own `default` arg
    # unchanged, i.e. "nothing saved" — a single mocked return_value would
    # incorrectly hand the *weak* list back for the *strong* lookup too.
    mocker.patch("services.settings_service.get_setting", side_effect=lambda key, default=None: default)


def test_no_content_is_confidently_not_sale_related():
    result = evaluate("", "", "")
    assert result.status == NOT_SALE_RELATED
    assert result.score == 0.0


def test_generic_marketing_with_no_discount_signal_is_not_sale_related():
    result = evaluate("New arrivals just landed", "Check out our new collection, refresh your wardrobe today.", "")
    assert result.status == NOT_SALE_RELATED


def test_a_single_weak_keyword_alone_never_reaches_eligible():
    # "sale" appears once in an otherwise-unrelated newsletter — weak
    # keywords alone must never clear the high bar by themselves.
    result = evaluate("Weekly Newsletter", "No sales here, just community updates.", "")
    assert result.status != ELIGIBLE


def test_multiple_strong_signals_together_reach_eligible():
    result = evaluate(
        "50% OFF Sitewide + Free Shipping",
        "Save big this weekend, use code SAVE20 at checkout. Was $120 now $79.",
        "",
    )
    assert result.status == ELIGIBLE
    assert result.score >= 5.0


def test_bogo_and_limited_time_offer_reach_eligible():
    result = evaluate("Flash Sale", "Limited time offer! Buy one get one free on all items.", "")
    assert result.status == ELIGIBLE


def test_a_single_strong_pattern_lands_in_needs_review_not_eligible_or_filtered():
    # One concrete discount mechanic but no corroborating signal — ambiguous,
    # not confidently either bucket.
    result = evaluate("Update", "Some items now have a reduced price.", "")
    assert result.status == NEEDS_REVIEW


def test_signal_can_come_purely_from_ocr_text():
    # Subject/body carry no sale language at all — every signal here comes
    # from the OCR'd image text, which must still be enough to clear the
    # not_sale_related floor (an all-text vs. all-image sale banner should
    # score the same).
    result = evaluate(
        "Check this out", "See the attached image.",
        "50% OFF everything, save now! Was $100 now $50. Use code SAVE50.",
    )
    assert result.status != NOT_SALE_RELATED


def test_receipt_email_is_not_sale_related():
    result = evaluate("Your receipt from Acme", "Thank you for your purchase. Order #12345 total $45.00", "")
    assert result.status == NOT_SALE_RELATED


def test_a_single_strong_keyword_alone_lands_in_needs_review_not_eligible():
    # "doorbuster" is a strong signal on its own, but the filter still wants
    # corroboration before full confidence — same treatment as a lone regex
    # strong-pattern hit (test_a_single_strong_pattern_lands_in_needs_review...).
    result = evaluate("This weekend", "Check out our doorbuster picks.", "")
    assert result.status == NEEDS_REVIEW


def test_strong_keyword_plus_weak_keywords_reach_eligible():
    result = evaluate(
        "Cyber Monday deals",
        "Huge savings, don't miss this deal — today only, exclusive discount for subscribers.",
        "",
    )
    assert result.status == ELIGIBLE


def test_admin_added_strong_keyword_is_honored(mocker):
    # An admin-added phrase (not in DEFAULT_STRONG_KEYWORDS) should carry the
    # same weight as a built-in one once saved via PUT /settings/sale-filter.
    mocker.patch(
        "services.settings_service.get_setting",
        side_effect=lambda key, default=None: ["super mega sale"] if key == "sale_filter_strong_keywords" else default,
    )
    result = evaluate("Don't miss it", "Our super mega sale starts now, save big.", "")
    assert "strong keyword: super mega sale" in result.reason
