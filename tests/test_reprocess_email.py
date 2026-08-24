"""Tests for services/email_processing.py::reprocess_email — the shared
process_email(message_id) core (spec section 11). Confirms the two additive
changes made for the automation pipeline (optional on_event forwarding,
offer_id in the return dict) didn't change behavior for the existing manual
Process/Reprocess and Create Brand callers, which don't pass on_event at
all."""
import types

from services.email_processing import reprocess_email


def test_reprocess_email_not_found_shape_is_unchanged(mocker, mock_get_session, mock_session):
    mocker.patch("services.email_processing.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = None

    result = reprocess_email(999999999)

    assert result == {"processing_status": "failed", "processing_error": "email not found", "offer_id": None}


def test_reprocess_email_forwards_on_event_to_analyze_email(mocker, mock_get_session, mock_session):
    email_stub = types.SimpleNamespace(
        id=1, subject="Sale", body="body", sender="brand@known-brand.com",
        received_date=None, processed_at=None, image_urls=None,
    )
    mock_session.query.return_value.filter.return_value.first.return_value = email_stub
    mocker.patch("services.email_processing.get_session", mock_get_session)
    mocker.patch("services.email_processing.extract_domain", return_value="known-brand.com")
    mocker.patch("services.email_processing.find_known_brand_by_domain", return_value=object())
    mocker.patch("ai.ocr.extract_and_merge", return_value={"ocr_raw": "", "ocr_clean": "", "merged": "body"})

    analyze = mocker.patch("ai.analyzer.analyze_email", return_value=None)  # short-circuit before build_offer

    sentinel_on_event = mocker.Mock()
    reprocess_email(1, on_event=sentinel_on_event)

    analyze.assert_called_once()
    assert analyze.call_args.kwargs["on_event"] is sentinel_on_event


def test_reprocess_email_success_includes_offer_id(mocker, mock_get_session, mock_session):
    email_stub = types.SimpleNamespace(
        id=1, subject="Sale", body="body", sender="brand@known-brand.com",
        received_date=None, processed_at=None, image_urls=None,
    )
    mock_session.query.return_value.filter.return_value.first.return_value = email_stub
    mocker.patch("services.email_processing.get_session", mock_get_session)
    mocker.patch("services.email_processing.extract_domain", return_value="known-brand.com")
    mocker.patch("services.email_processing.find_known_brand_by_domain", return_value=object())
    mocker.patch("ai.ocr.extract_and_merge", return_value={"ocr_raw": "", "ocr_clean": "", "merged": "body"})
    mocker.patch("ai.analyzer.analyze_email", return_value={"brand": "Nike", "discount_percentage": 40})

    offer_stub = types.SimpleNamespace(id=None)

    def build_offer_side_effect(*args, **kwargs):
        offer_stub.id = 555  # simulates the id SQLAlchemy would assign on flush
        return offer_stub
    mocker.patch("ai.analyzer.build_offer", side_effect=build_offer_side_effect)

    def flush_side_effect():
        pass  # the real flush is what would populate offer.id against a real DB
    mock_session.flush.side_effect = flush_side_effect

    result = reprocess_email(1)

    assert result["processing_status"] == "processed"
    assert result["offer_id"] == 555
