from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

from database.models import DeviceToken, Offer
from jobs import notify_matching_offer
from jobs.notify_matching_offer import NotifyMatchingOfferJob, stale_reason
from services.offer_matching import offer_matches_preferences
from services.offer_notifications import notification_copy


@pytest.fixture(autouse=True)
def _fresh_offer(request, mocker):
    if "stale" not in request.node.name:
        mocker.patch.object(notify_matching_offer, "_stale_reason_for", return_value=None)
    if "same_content" not in request.node.name:
        mocker.patch.object(notify_matching_offer, "_recently_sent_same_content", return_value=set())


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
    mocker.patch("jobs.notify_matching_offer.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = None
    assert NotifyMatchingOfferJob().collect_work({"payload": {"offer_id": 99}}) == []


def test_spec_matrix_and_mode():
    """User: Nike + Adidas brands, Shoes + Clothing categories.

    Explicit mode="and" — OFFER_MATCH_MODE's default is "or" (see config.py:
    "and" tends to produce an empty feed/no notifications with few offers
    per brand), so this test pins the mode it actually exercises rather than
    relying on the global default.
    """
    brands = ["Nike", "Adidas"]
    cats = ["Shoes", "Clothing"]
    assert offer_matches_preferences({"brand": "Nike", "category": "Shoes"}, brands, cats, mode="and") is True
    assert offer_matches_preferences({"brand": "Nike", "category": "Clothing"}, brands, cats, mode="and") is True
    assert offer_matches_preferences({"brand": "Nike", "category": "Watches"}, brands, cats, mode="and") is False
    assert offer_matches_preferences({"brand": "Apple", "category": "Shoes"}, brands, cats, mode="and") is False
    assert offer_matches_preferences({"brand": "Adidas", "category": "Clothing"}, brands, cats, mode="and") is True


def test_collect_work_only_tokens_for_matching_devices(mocker, mock_get_session, mock_session):
    offer = _offer()
    mocker.patch("jobs.notify_matching_offer.get_session", mock_get_session)
    mocker.patch(
        "jobs.notify_matching_offer.matching_profile_rows",
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
    mocker.patch("jobs.notify_matching_offer.get_session", mock_get_session)
    mocker.patch("jobs.notify_matching_offer.matching_profile_rows", return_value=[])
    mock_session.query.return_value.filter.return_value.first.return_value = _offer()
    assert NotifyMatchingOfferJob().collect_work({"payload": {"offer_id": 9}}) == []


def test_collect_work_logs_when_matches_have_no_active_tokens(mocker, mock_get_session, mock_session):
    """Matching prefs with no live DeviceToken must explain why notify is empty."""
    offer = _offer()
    mocker.patch("jobs.notify_matching_offer.get_session", mock_get_session)
    mocker.patch(
        "jobs.notify_matching_offer.matching_profile_rows",
        return_value=[("device-a", "user-1"), ("device-b", "user-2")],
    )
    append_log = mocker.patch("services.job_service.append_log")

    offer_q = mocker.Mock()
    offer_q.filter.return_value.first.return_value = offer

    notif_filter = mocker.Mock()
    notif_filter.__iter__ = lambda self: iter([])
    notif_q = mocker.Mock()
    notif_q.filter.return_value = notif_filter

    active_filter = mocker.Mock()
    active_filter.all.return_value = []
    inactive_filter = mocker.Mock()
    inactive_filter.count.return_value = 3
    token_q = mocker.Mock()
    token_q.filter.side_effect = [active_filter, inactive_filter]

    # collect_work query order: Offer → OfferNotification.device_id → DeviceToken → DeviceToken.id
    mock_session.query.side_effect = [offer_q, notif_q, token_q, token_q]

    items = NotifyMatchingOfferJob().collect_work({"id": 42, "payload": {"offer_id": 9}})
    assert items == []
    assert append_log.called
    msg = append_log.call_args.args[1]
    assert "0 active FCM tokens" in msg
    assert "re-register" in msg


def test_process_item_sends_personalized_copy_and_records(mocker, mock_get_session, mock_session):
    offer = _offer()
    mocker.patch("jobs.notify_matching_offer.get_session", mock_get_session)
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


def test_collect_work_matches_sale_alerts_then_skips_push_without_fcm(mocker):
    match = mocker.patch(
        "services.sale_alert_service.match_brand_alerts_for_offer", return_value={"ok": True, "matched": 0},
    )
    mocker.patch("jobs.notify_matching_offer.fcm_client.is_configured", return_value=False)
    mocker.patch("services.job_service.append_log")

    assert NotifyMatchingOfferJob().collect_work({"id": 5, "payload": {"offer_id": 9}}) == []
    match.assert_called_once_with(9, notify=True)


def test_stale_reason_for_expired_or_old_email():
    now = datetime.utcnow()
    assert stale_reason(SimpleNamespace(expiry_date=now - timedelta(days=1)), now) == "offer already expired"
    assert "days old" in stale_reason(SimpleNamespace(expiry_date=None), now - timedelta(days=90))
    assert stale_reason(SimpleNamespace(expiry_date=now + timedelta(days=3)), now - timedelta(hours=2)) is None
    assert stale_reason(SimpleNamespace(expiry_date=None), None) is None


def test_collect_work_does_not_notify_stale_offers(mocker):
    mocker.patch.object(notify_matching_offer, "_stale_reason_for", return_value="source email is 95 days old")
    match = mocker.patch("services.sale_alert_service.match_brand_alerts_for_offer")
    mocker.patch("services.job_service.append_log")

    assert NotifyMatchingOfferJob().collect_work({"id": 5, "payload": {"offer_id": 9}}) == []
    match.assert_not_called()


def test_same_content_skips_devices_that_got_the_identical_push(mock_session):
    offer = SimpleNamespace(id=1385, brand="Levi's", title="40% off + free shipping for Red Tab™ members")
    mock_session.query.return_value.join.return_value.filter.return_value = [SimpleNamespace(device_id="dev-a")]

    assert notify_matching_offer._recently_sent_same_content(mock_session, offer, ["dev-a", "dev-b"]) == {"dev-a"}


def test_same_content_check_needs_a_title_and_brand(mock_session):
    offer = SimpleNamespace(id=1, brand="Levi's", title=None)
    assert notify_matching_offer._recently_sent_same_content(mock_session, offer, ["dev-a"]) == set()
    mock_session.query.assert_not_called()
