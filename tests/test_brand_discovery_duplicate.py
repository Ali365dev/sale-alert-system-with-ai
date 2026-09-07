"""Tests for services/brand_discovery/duplicate_detector.py."""
import types

from services.brand_discovery.duplicate_detector import find_brand_duplicate


def test_domain_or_name_match_short_circuits_before_any_social_check(mocker, mock_get_session, mock_session):
    mocker.patch("services.brand_discovery.duplicate_detector.get_session", mock_get_session)
    mocker.patch(
        "services.brand_discovery.duplicate_detector.find_possible_duplicate",
        return_value=(42, 1.0, "domain_match"),
    )
    result = find_brand_duplicate("Acme", "https://acme.com", {"facebook": {"url": "https://facebook.com/acme"}})
    assert result == (42, 1.0, "domain_match")


def test_social_link_overlap_detected_when_no_domain_or_name_match(mocker, mock_get_session, mock_session):
    mocker.patch("services.brand_discovery.duplicate_detector.get_session", mock_get_session)
    mocker.patch("services.brand_discovery.duplicate_detector.find_possible_duplicate", return_value=(None, None, None))

    existing_brand = types.SimpleNamespace(
        id=7, social_links='{"facebook": "https://facebook.com/acmebrand/"}',
    )
    mock_session.query.return_value.all.return_value = [existing_brand]

    result = find_brand_duplicate(
        "Totally Different Name", "https://different-domain.com",
        {"facebook": {"url": "https://facebook.com/acmebrand"}},  # no trailing slash, must still match
    )
    assert result == (7, 1.0, "social_link_match")


def test_no_duplicate_found_returns_all_none(mocker, mock_get_session, mock_session):
    mocker.patch("services.brand_discovery.duplicate_detector.get_session", mock_get_session)
    mocker.patch("services.brand_discovery.duplicate_detector.find_possible_duplicate", return_value=(None, None, None))
    mock_session.query.return_value.all.return_value = []

    result = find_brand_duplicate("New Brand", "https://new-brand.com", {})
    assert result == (None, None, None)


def test_social_check_skipped_entirely_when_no_social_links_given(mocker, mock_get_session, mock_session):
    mocker.patch("services.brand_discovery.duplicate_detector.get_session", mock_get_session)
    mocker.patch("services.brand_discovery.duplicate_detector.find_possible_duplicate", return_value=(None, None, None))

    result = find_brand_duplicate("New Brand", "https://new-brand.com", None)
    assert result == (None, None, None)
    mock_session.query.assert_not_called()
