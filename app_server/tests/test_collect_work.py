"""Tests for EmailAutomationJob.collect_work — history-based discovery of
new messages, and the idempotency claim (spec scenario 11: duplicate offer
prevented; scenario 3: duplicate notification doesn't create a duplicate
job — this is the collect_work half of that guarantee, the job-dispatch
half is covered in tests/test_automation_webhook.py)."""
from services.jobs.email_automation import EmailAutomationJob


def test_collect_work_returns_empty_when_automation_disabled(mocker):
    mocker.patch("services.settings_service.get_setting", return_value=False)

    job = EmailAutomationJob()
    items = job.collect_work({"id": 1})

    assert items == []


def test_collect_work_returns_empty_with_no_cursor_yet(mocker):
    def get_setting_side_effect(key, default=None):
        return {"automatic_email_processing": True, "gmail_last_history_id": ""}.get(key, default)
    mocker.patch("services.settings_service.get_setting", side_effect=get_setting_side_effect)

    job = EmailAutomationJob()
    items = job.collect_work({"id": 1})

    assert items == []


def test_collect_work_claims_new_messages_and_skips_already_run(mocker, mock_get_session, mock_session):
    def get_setting_side_effect(key, default=None):
        return {"automatic_email_processing": True, "gmail_last_history_id": "1000"}.get(key, default)
    mocker.patch("services.settings_service.get_setting", side_effect=get_setting_side_effect)
    mocker.patch("services.settings_service.set_setting")
    mocker.patch("services.jobs.email_automation.get_session", mock_get_session)
    mocker.patch("gmail.gmail_service._get_session", return_value=mocker.Mock())

    history_records = [
        {"id": "1005", "messagesAdded": [{"message": {"id": "msg-new"}}]},
        {"id": "1010", "messagesAdded": [{"message": {"id": "msg-already-claimed"}}]},
    ]
    mocker.patch("gmail.gmail_service.list_history", return_value=history_records)

    # "msg-already-claimed" was claimed by a previous run; "msg-new" wasn't.
    # (.in_() is evaluated on the real model column to build the filter
    # condition, not chained on the mock — the mock only sees .filter(...).all())
    mock_session.query.return_value.filter.return_value.all.return_value = [("msg-already-claimed",)]

    job = EmailAutomationJob()
    items = job.collect_work({"id": 7})

    item_ids = [i.id for i in items]
    assert "msg-new" in item_ids
    assert "msg-already-claimed" not in item_ids
    # New message gets claimed (an EmailAutomationRun row added for it).
    added = [call.args[0] for call in mock_session.add.call_args_list]
    assert any(getattr(row, "gmail_message_id", None) == "msg-new" for row in added)


def test_collect_work_resets_cursor_on_404(mocker):
    def get_setting_side_effect(key, default=None):
        return {"automatic_email_processing": True, "gmail_last_history_id": "too-old-1"}.get(key, default)
    mocker.patch("services.settings_service.get_setting", side_effect=get_setting_side_effect)
    mocker.patch("gmail.gmail_service._get_session", return_value=mocker.Mock())
    mocker.patch("gmail.gmail_service.list_history", side_effect=RuntimeError("404 Not Found"))
    mocker.patch("gmail.gmail_service.get_mailbox_profile", return_value={"historyId": "9999"})
    set_setting = mocker.patch("services.settings_service.set_setting")

    job = EmailAutomationJob()
    items = job.collect_work({"id": 1})

    assert items == []
    set_setting.assert_called_once_with("gmail_last_history_id", "9999", category="gmail")
