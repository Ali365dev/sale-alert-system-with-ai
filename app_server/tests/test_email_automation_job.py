"""Tests for services/jobs/email_automation.py — the per-message pipeline
(process_item) and the notification helper. Covers spec scenarios: email is
fetched (4), Gmail label is applied (5), AI analysis is triggered (6),
provider fallback works (7 — via the same on_event plumbing already covered
by services/ai_job_logging.py, exercised here as "on_event is forwarded"),
offer is created (8), push notification is sent (9), failed AI analysis is
recorded (10), duplicate offer is prevented (11 — via reprocess_email being
called at most once per message, and the pre-claim in collect_work).

All Gmail/AI/FCM/DB calls are mocked — see tests/conftest.py's module
docstring for why (no test-database infrastructure exists in this repo)."""
import types

from services.jobs.email_automation import EmailAutomationJob


def _existing_email(email_id=42, subject="50% Off Everything"):
    stub = types.SimpleNamespace(id=email_id, subject=subject)
    return stub


def _patch_job_logging(mocker):
    """process_item logs constantly via job_service — no-op it out so tests
    only assert on the things they actually care about."""
    mocker.patch("services.job_service.set_stage")
    mocker.patch("services.job_service.append_log")


def test_process_item_fetches_existing_email_and_analyzes(mocker, mock_get_session, mock_session):
    """Scenario 4 (email fetched) + 6 (AI analysis triggered): a message
    already stored as an Email row is reused, not re-fetched from Gmail,
    and reprocess_email is called with that email's id."""
    _patch_job_logging(mocker)
    mocker.patch("services.jobs.email_automation.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = _existing_email()

    mocker.patch("gmail.gmail_service._get_session", return_value=mocker.Mock())
    fetch = mocker.patch("gmail.gmail_service.fetch_single_message")
    mocker.patch("gmail.gmail_labels.get_or_create_label_id", return_value="Label_1")
    apply_label = mocker.patch("gmail.gmail_labels.apply_label")
    mocker.patch("ai._llm.describe_active_provider", return_value={"provider": "gemini", "key_identifier": None})

    def get_setting_side_effect(key, default=None):
        return {"auto_apply_gmail_label": True, "gmail_label": "sales_offers"}.get(key, default)
    mocker.patch("services.settings_service.get_setting", side_effect=get_setting_side_effect)

    reprocess = mocker.patch(
        "services.email_processing.reprocess_email",
        return_value={"processing_status": "processed", "processing_error": None, "offer_id": 555},
    )
    notify = mocker.patch.object(EmailAutomationJob, "_send_offer_notification")

    job = EmailAutomationJob()
    outcome = job.process_item(job_id=1, item=mocker.Mock(id="gmail-msg-1", label="gmail-msg-1"))

    assert outcome == "successful"
    fetch.assert_not_called()  # already-existing Email row was reused, not re-fetched
    apply_label.assert_called_once()  # Scenario 5: label applied
    reprocess.assert_called_once()
    assert reprocess.call_args.args[0] == 42  # called with the existing email's id
    assert "on_event" in reprocess.call_args.kwargs  # Scenario 7: provider-fallback logging forwarded
    notify.assert_called_once_with(1, 555)  # Scenario 9 dispatch: notification triggered with the new offer's id


def test_process_item_records_ai_failure_without_notifying(mocker, mock_get_session, mock_session):
    """Scenario 10: a failed analysis is recorded (outcome "failed"), and no
    notification is ever attempted for it."""
    _patch_job_logging(mocker)
    mocker.patch("services.jobs.email_automation.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = _existing_email()
    mocker.patch("gmail.gmail_service._get_session", return_value=mocker.Mock())
    mocker.patch("gmail.gmail_labels.get_or_create_label_id", return_value="Label_1")
    mocker.patch("gmail.gmail_labels.apply_label")
    mocker.patch("ai._llm.describe_active_provider", return_value={"provider": "gemini", "key_identifier": None})
    mocker.patch("services.settings_service.get_setting", return_value=True)
    mocker.patch(
        "services.email_processing.reprocess_email",
        return_value={"processing_status": "failed", "processing_error": "AI returned no result", "offer_id": None},
    )
    notify = mocker.patch.object(EmailAutomationJob, "_send_offer_notification")

    job = EmailAutomationJob()
    outcome = job.process_item(job_id=1, item=mocker.Mock(id="gmail-msg-2", label="gmail-msg-2"))

    assert outcome == "failed"
    notify.assert_not_called()  # Do not send a notification if offer creation failed


def test_process_item_treats_unmatched_brand_as_skipped_not_failed(mocker, mock_get_session, mock_session):
    """The sender-domain gate routing to Unknown Emails is a graceful skip
    (matches process_pending.py's own "skipped" outcome for the same gate),
    not a pipeline failure."""
    _patch_job_logging(mocker)
    mocker.patch("services.jobs.email_automation.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = _existing_email()
    mocker.patch("gmail.gmail_service._get_session", return_value=mocker.Mock())
    mocker.patch("gmail.gmail_labels.get_or_create_label_id", return_value="Label_1")
    mocker.patch("gmail.gmail_labels.apply_label")
    mocker.patch("ai._llm.describe_active_provider", return_value={"provider": "gemini", "key_identifier": None})
    mocker.patch("services.settings_service.get_setting", return_value=True)
    mocker.patch(
        "services.email_processing.reprocess_email",
        return_value={
            "processing_status": "failed",
            "processing_error": "No matching brand — routed to Unknown Emails",
            "offer_id": None,
        },
    )
    notify = mocker.patch.object(EmailAutomationJob, "_send_offer_notification")

    job = EmailAutomationJob()
    outcome = job.process_item(job_id=1, item=mocker.Mock(id="gmail-msg-3", label="gmail-msg-3"))

    assert outcome == "skipped"
    notify.assert_not_called()


def test_process_item_fetch_failure_is_recoverable_not_fatal(mocker, mock_get_session, mock_session):
    """A Gmail fetch failure must return "failed" for this item, not raise
    — an uncaught exception here would abort the whole job (see
    services/jobs/base.py's critical/recoverable split), which would stop
    every other message in the same batch too."""
    _patch_job_logging(mocker)
    mocker.patch("services.jobs.email_automation.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = None  # not already fetched
    mocker.patch("gmail.gmail_service._get_session", return_value=mocker.Mock())
    mocker.patch("gmail.gmail_service.fetch_single_message", side_effect=RuntimeError("Gmail API 503"))

    job = EmailAutomationJob()
    outcome = job.process_item(job_id=1, item=mocker.Mock(id="gmail-msg-4", label="gmail-msg-4"))

    assert outcome == "failed"  # not raised


def test_process_item_label_failure_does_not_block_offer_creation(mocker, mock_get_session, mock_session):
    """Labeling is not fatal to the pipeline (spec section 4 doesn't
    require it to be) — an offer with no label is still a real offer."""
    _patch_job_logging(mocker)
    mocker.patch("services.jobs.email_automation.get_session", mock_get_session)
    mock_session.query.return_value.filter.return_value.first.return_value = _existing_email()
    mocker.patch("gmail.gmail_service._get_session", return_value=mocker.Mock())
    mocker.patch("gmail.gmail_labels.get_or_create_label_id", side_effect=RuntimeError("label API down"))
    mocker.patch("ai._llm.describe_active_provider", return_value={"provider": "gemini", "key_identifier": None})
    mocker.patch("services.settings_service.get_setting", return_value=True)
    mocker.patch(
        "services.email_processing.reprocess_email",
        return_value={"processing_status": "processed", "processing_error": None, "offer_id": 777},
    )
    notify = mocker.patch.object(EmailAutomationJob, "_send_offer_notification")

    job = EmailAutomationJob()
    outcome = job.process_item(job_id=1, item=mocker.Mock(id="gmail-msg-5", label="gmail-msg-5"))

    assert outcome == "successful"
    notify.assert_called_once_with(1, 777)


def test_send_offer_notification_queues_personalized_job(mocker):
    mocker.patch("services.job_service.append_log")
    mocker.patch("services.push.fcm_client.is_configured", return_value=True)
    schedule = mocker.patch("services.offer_notifications.schedule_for_new_offer")

    EmailAutomationJob()._send_offer_notification(job_id=1, offer_id=555)

    schedule.assert_called_once_with(555)


def test_send_offer_notification_skips_when_fcm_not_configured(mocker):
    mocker.patch("services.job_service.append_log")
    mocker.patch("services.push.fcm_client.is_configured", return_value=False)
    schedule = mocker.patch("services.offer_notifications.schedule_for_new_offer")
    send = mocker.patch("services.push.fcm_client.send_multicast")

    EmailAutomationJob()._send_offer_notification(job_id=1, offer_id=555)

    schedule.assert_not_called()
    send.assert_not_called()
