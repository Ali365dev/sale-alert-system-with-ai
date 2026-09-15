from types import SimpleNamespace

from database.models import DeviceToken, Offer
from services.jobs.notify_matching_offer import NotifyMatchingOfferJob
from services.offer_matching import offer_matches_preferences
from services.offer_notifications import notification_copy


def _offer(**kwargs):
    defaults = dict(
        id=9,
        brand="Nike",
        category="Shoes",
        subcategory=None,
        summary="Up to 40% off Nike shoes.",
        title=None,
        discount_percentage=40,
        is_active=True,
    )
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_collect_work_empty_without_offer_id():
    assert NotifyMatchingOfferJob().collect_work({"payload": {}}) == []


def test_collect_work_empty_when_offer_missing(mocker, mock_get_session, mock_session):
    mocker.patch("services.jobs.notify_matching_offer.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = None
    assert NotifyMatchingOfferJob().collect_work({"payload": {"offer_id": 99}}) == []


def test_spec_matrix_and_mode():
    """User: Nike + Adidas brands, Shoes + Clothing categories."""
    brands = ["Nike", "Adidas"]
    cats = ["Shoes", "Clothing"]
    assert offer_matches_preferences({"brand": "Nike", "category": "Shoes"}, brands, cats) is True
    assert offer_matches_preferences({"brand": "Nike", "category": "Clothing"}, brands, cats) is True
    assert offer_matches_preferences({"brand": "Nike", "category": "Watches"}, brands, cats) is False
    assert offer_matches_preferences({"brand": "Apple", "category": "Shoes"}, brands, cats) is False
    assert offer_matches_preferences({"brand": "Adidas", "category": "Clothing"}, brands, cats) is True


def test_collect_work_only_tokens_for_matching_devices(mocker, mock_get_session, mock_session):
    offer = _offer()
    mocker.patch("services.jobs.notify_matching_offer.get_session", mock_get_session)
    mocker.patch(
        "services.jobs.notify_matching_offer.matching_profile_rows",
        return_value=[
            ("device-match", "user-1"),
            ("device-no-token", "user-2"),
            ("device-already", "user-3"),
        ],
    )

    match_token = SimpleNamespace(token="fcm-match", device_id="device-match", is_active=True)
    already_row = SimpleNamespace(device_id="device-already")

    def query_side_effect(model):
        q = mocker.Mock()
        if model is Offer:
            q.filter.return_value.first.return_value = offer
        elif model is DeviceToken:
            q.filter.return_value.all.return_value = [match_token]
        else:
            q.filter.return_value = [already_row]
        return q

    mock_session.query.side_effect = query_side_effect

    items = NotifyMatchingOfferJob().collect_work({"payload": {"offer_id": 9}})
    assert len(items) == 1
    recipients = items[0].id
    assert [r["device_id"] for r in recipients] == ["device-match"]
    assert recipients[0]["token"] == "fcm-match"


def test_collect_work_empty_when_no_matching_profiles(mocker, mock_get_session, mock_session):
    mocker.patch("services.jobs.notify_matching_offer.get_session", mock_get_session)
    mocker.patch("services.jobs.notify_matching_offer.matching_profile_rows", return_value=[])
    mock_session.query.return_value.filter.return_value.first.return_value = _offer()
    assert NotifyMatchingOfferJob().collect_work({"payload": {"offer_id": 9}}) == []


def test_process_item_sends_personalized_copy_and_records(mocker, mock_get_session, mock_session):
    offer = _offer()
    mocker.patch("services.jobs.notify_matching_offer.get_session", mock_get_session)
    mocker.patch(
        "services.job_service.get_job",
        return_value={"payload": {"offer_id": 9}},
    )
    mocker.patch("services.job_service.append_log")
    mock_session.query.return_value.filter.return_value.first.return_value = offer
    mock_session.query.return_value.filter_by.return_value.first.return_value = None

    send = mocker.patch(
        "services.push.fcm_client.send_multicast",
        return_value=SimpleNamespace(
            success_count=1,
            failure_count=0,
            responses=[SimpleNamespace(success=True, exception=None)],
        ),
    )

    item = SimpleNamespace(
        id=[{"token": "fcm-1", "device_id": "dev-1", "user_id": "u1"}],
        label="Offer 9: 1 device(s)",
    )
    outcome = NotifyMatchingOfferJob().process_item(1, item)
    assert outcome == "successful"

    tokens, title, body, data = send.call_args.args
    assert tokens == ["fcm-1"]
    assert "Nike" in title
    assert "40%" in body or "shoes" in body.lower()
    assert data["dealId"] == "9"
    assert data["offerId"] == "9"
    mock_session.add.assert_called_once()
    saved = mock_session.add.call_args.args[0]
    assert saved.device_id == "dev-1"
    assert saved.offer_id == 9


def test_notification_copy_explains_the_match():
    title, body, data = notification_copy(_offer())
    assert title.lower().startswith("nike")
    assert "40" in body
    assert data["dealId"] == "9"
