from datetime import datetime, timedelta

from services import device_tokens


def test_deactivates_only_tokens_unseen_past_the_cutoff(mocker, mock_get_session, mock_session):
    mocker.patch.object(device_tokens, "get_session", mock_get_session)
    mocker.patch.object(device_tokens, "_LAST_SEEN_RELIABLE_SINCE", datetime(2000, 1, 1))
    update = mock_session.query.return_value.filter.return_value.update
    update.return_value = 3

    assert device_tokens.deactivate_stale_tokens(days=60) == 3

    (criteria_active, criteria_seen) = mock_session.query.return_value.filter.call_args.args
    cutoff = criteria_seen.right.value
    assert datetime.utcnow() - timedelta(days=61) < cutoff < datetime.utcnow() - timedelta(days=59)
    update.assert_called_once_with({"is_active": False}, synchronize_session=False)


def test_does_nothing_until_last_seen_has_a_full_window_of_real_data(mocker, mock_get_session, mock_session):
    """last_seen_at was never refreshed before the register fix — retiring on
    it straight away would switch off live installs."""
    mocker.patch.object(device_tokens, "get_session", mock_get_session)

    assert device_tokens.deactivate_stale_tokens(days=60) == 0
    mock_session.query.assert_not_called()
