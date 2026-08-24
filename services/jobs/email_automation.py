"""Automatic new-email pipeline: Gmail change detected (Pub/Sub webhook or
the scheduler backstop — see app/api/routers/automation.py and
services/scheduler.py::check_gmail_for_changes) -> fetch -> label -> analyze
-> offer -> push notification, entirely on this job's own background
thread (never on the webhook request thread or the scheduler's thread).

Reuses services/email_processing.py::reprocess_email for the sender-domain
gate + OCR + AI-analysis + offer-creation core — the exact same function the
manual Process/Reprocess button and Create Brand flow call. This file only
adds what's specific to the automatic trigger: history-based discovery of
which messages are new, fetching + labeling them, and the push notification
on success.
"""
import json
from datetime import datetime

from database.db import get_session
from database.models import DeviceToken, Email, EmailAutomationRun, Offer
from services.jobs.base import BackgroundJob, WorkItem
from services.retry import retry_with_backoff

# FETCHING and LABELING call the Gmail API and must be treated as
# per-message recoverable failures (spec: "FETCHING -> failed" is a per-item
# outcome), not job-ending — see services/jobs/base.py's critical/recoverable
# split. Only genuinely unexpected errors are allowed to propagate and stop
# the whole job.
_GMAIL_STEP_ERRORS = (Exception,)


class EmailAutomationJob(BackgroundJob):
    job_type = "email_automation"

    def collect_work(self, job: dict) -> list[WorkItem]:
        from gmail.gmail_service import _get_session, get_mailbox_profile, list_history
        from services.settings_service import get_setting, set_setting

        # Defense in depth: the toggle is meant to be checked before this
        # job is even started (see app/api/routers/automation.py's dispatch
        # helper), but checking again here means a disabled toggle is
        # honored even if something started this job type through the
        # generic /api/jobs/<type>/start route directly.
        if not get_setting("automatic_email_processing", default=False):
            return []

        start_history_id = get_setting("gmail_last_history_id", default="")
        if not start_history_id:
            # No cursor yet — ensure_gmail_watch_active() (called from the
            # scheduler backstop) seeds this on first-ever activation.
            return []

        session = _get_session()
        try:
            records = retry_with_backoff(
                lambda: list_history(session, start_history_id),
                label="Gmail history.list",
            )
        except Exception as exc:
            # A too-old startHistoryId (Gmail garbage-collects history after
            # ~1 week of inactivity) surfaces as an HTTP 404 here — that's
            # "start fresh from now," not a transient error to keep retrying.
            if "404" in str(exc):
                profile = get_mailbox_profile(session)
                set_setting("gmail_last_history_id", profile["historyId"], category="gmail")
                return []
            raise

        message_ids: list[str] = []
        seen_ids: set[str] = set()
        latest_history_id = start_history_id
        for record in records:
            latest_history_id = record.get("id", latest_history_id)
            for added in record.get("messagesAdded", []):
                mid = added.get("message", {}).get("id")
                if mid and mid not in seen_ids:
                    seen_ids.add(mid)
                    message_ids.append(mid)

        with get_session() as db:
            already_run = {
                row[0] for row in
                db.query(EmailAutomationRun.gmail_message_id)
                .filter(EmailAutomationRun.gmail_message_id.in_(message_ids)).all()
            } if message_ids else set()
            already_processed = {
                row[0] for row in
                db.query(Email.gmail_message_id)
                .filter(Email.gmail_message_id.in_(message_ids), Email.processing_status != "unprocessed").all()
            } if message_ids else set()

        new_ids = [mid for mid in message_ids if mid not in already_run and mid not in already_processed]

        # Claim each message up front, before any processing — closes the
        # race between the webhook and the scheduler backstop firing close
        # together over the same message. Whichever run's insert lands
        # first wins; the DB's unique constraint on gmail_message_id
        # guarantees the second is a no-op, not a duplicate offer.
        with get_session() as db:
            for mid in new_ids:
                db.add(EmailAutomationRun(gmail_message_id=mid, job_id=job["id"]))

        # Advance the cursor here (not in after_run) — the job framework
        # skips after_run entirely when there's no work (the common "nothing
        # new" poll outcome), so this is the only place guaranteed to run
        # every time. Trade-off: if processing then crashes critically
        # partway through this batch, the cursor has already moved past
        # whatever was claimed-but-not-finished — those messages stay
        # recoverable via the existing manual Process/Reprocess button
        # (they're never silently lost, just need a manual nudge).
        if latest_history_id != start_history_id:
            set_setting("gmail_last_history_id", latest_history_id, category="gmail")

        return [WorkItem(id=mid, label=mid) for mid in new_ids]

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from ai._llm import describe_active_provider
        from gmail.gmail_labels import apply_label, get_or_create_label_id
        from gmail.gmail_service import _get_session, fetch_single_message
        from services import job_service
        from services.ai_job_logging import (
            make_provider_event_logger,
            provider_key_lines,
        )
        from services.email_processing import reprocess_email
        from services.settings_service import get_setting

        message_id = item.id
        job_service.set_stage(job_id, "RECEIVED")

        # ── FETCHING ─────────────────────────────────────────────────────
        job_service.set_stage(job_id, "FETCHING")
        job_service.append_log(job_id, f"→ Fetching email {message_id}", category="gmail")
        try:
            session = _get_session()
            with get_session() as db:
                existing = db.query(Email).filter(Email.gmail_message_id == message_id).first()
                existing_id = existing.id if existing else None

            if existing_id is not None:
                email_id = existing_id
            else:
                raw = retry_with_backoff(
                    lambda: fetch_single_message(session, message_id),
                    label=f"Gmail fetch {message_id}",
                )
                with get_session() as db:
                    row = Email(
                        gmail_message_id=raw["gmail_message_id"],
                        sender=raw["sender"],
                        subject=raw["subject"],
                        body=raw["body"],
                        image_urls=json.dumps(raw["image_urls"]) if raw["image_urls"] else None,
                        received_date=raw["received_date"],
                        processed_at=datetime.utcnow(),
                    )
                    db.add(row)
                    db.flush()
                    email_id = row.id
            job_service.append_log(job_id, "✓ Email fetched", severity="success", category="gmail")
        except _GMAIL_STEP_ERRORS as exc:
            job_service.append_log(job_id, f"✗ Fetching failed: {exc}", severity="error", category="gmail")
            return "failed"

        with get_session() as db:
            e = db.query(Email).filter(Email.id == email_id).first()
            subject = e.subject if e else message_id

        # ── LABELING ─────────────────────────────────────────────────────
        if get_setting("auto_apply_gmail_label", default=True):
            job_service.set_stage(job_id, "LABELING")
            label_name = get_setting("gmail_label", default="sales_offers")
            job_service.append_log(job_id, f"→ Applying label: {label_name}", category="gmail")
            try:
                label_id = get_or_create_label_id(session, label_name)
                apply_label(session, message_id, label_id)
                job_service.append_log(job_id, "✓ Label applied", severity="success", category="gmail")
            except _GMAIL_STEP_ERRORS as exc:
                # Labeling is not fatal to the pipeline — an offer with no
                # label is still a real offer; log and continue.
                job_service.append_log(job_id, f"⚠ Label apply failed: {exc}", severity="warning", category="gmail")

        # ── ANALYZING / CREATING_OFFER (reuses the shared core) ─────────
        job_service.set_stage(job_id, "ANALYZING")
        active = describe_active_provider()
        job_service.append_log(job_id, f"→ Analysing \"{subject[:60]}\"\n{provider_key_lines(active)}", category="ai")

        result = reprocess_email(email_id, on_event=make_provider_event_logger(job_id, subject))

        if result["processing_status"] != "processed":
            severity = "warning" if "Unknown Emails" in (result["processing_error"] or "") else "error"
            job_service.append_log(
                job_id, f"⚠ ✗ Failed to analyse \"{subject[:60]}\"\nReason: {result['processing_error']}",
                severity=severity, category="ai",
            )
            outcome = "skipped" if "Unknown Emails" in (result["processing_error"] or "") else "failed"
            return outcome

        offer_id = result["offer_id"]
        job_service.set_stage(job_id, "CREATING_OFFER")
        job_service.append_log(job_id, f"✓ Offer created #{offer_id}", severity="success", category="offer")

        # ── NOTIFYING ────────────────────────────────────────────────────
        job_service.set_stage(job_id, "NOTIFYING")
        self._send_offer_notification(job_id, offer_id)

        job_service.set_stage(job_id, "COMPLETED")
        job_service.append_log(job_id, "✓ Automation completed", severity="success", category="system")
        return "successful"

    def _send_offer_notification(self, job_id: int, offer_id: int) -> None:
        from services import job_service
        from services.push import fcm_client

        with get_session() as db:
            offer = db.query(Offer).filter(Offer.id == offer_id).first()
            if offer is None:
                return
            brand = offer.brand or "New offer"
            discount = f"{int(offer.discount_percentage)}% off" if offer.discount_percentage else (offer.offer_value or "")
            tokens = [
                row.token for row in
                db.query(DeviceToken.token).filter(DeviceToken.is_active.is_(True)).all()
            ]

        if not tokens:
            job_service.append_log(job_id, "→ No registered devices — notification skipped", category="push")
            return
        if not fcm_client.is_configured():
            job_service.append_log(job_id, "→ Firebase not configured — notification skipped", severity="warning", category="push")
            return

        title = "New offer detected"
        body = f"{brand} — {discount}" if discount else brand
        response = fcm_client.send_multicast(tokens[:500], title, body, {"dealId": str(offer_id)})
        job_service.append_log(
            job_id, f"✓ Push notification sent ({response.success_count}/{len(tokens[:500])} device(s))",
            severity="success", category="push",
        )

    def after_run(self, job_id: int, job: dict) -> None:
        from services import job_service

        job_service.set_result(job_id, {
            "processed": job["successful"],
            "failed": job["failed"],
            "skipped": job["skipped"],
        })
