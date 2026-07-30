"""Concurrent, resumable "fetch new emails + AI-analyse + save" job.

Runs on a background thread started by api/jobs.py. Work is fanned out over
a small thread pool (network + LLM calls are I/O-bound, so threads are the
right tool here — no multiprocessing needed). Every completed email is saved
and reflected in the Job row immediately so the frontend's 1s poll always
sees fresh state, and the whole thing is safe to cancel mid-flight.
"""
import json
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

from sqlalchemy import exists

from ai.analyzer import analyze_email
from config import logger
from database.db import get_session
from database.models import Email, Offer
from scheduler.jobs import _build_offer
from services import job_service
from services.retry import retry_with_backoff

_progress_lock = threading.Lock()


def _collect_work_items() -> tuple[object, list[dict]]:
    """Gather both brand-new Gmail messages and any already-stored emails
    that never got an offer (e.g. left over from a crashed previous run)."""
    from gmail.gmail_service import list_new_message_ids

    session, new_ids = list_new_message_ids()
    items = [{"kind": "new", "gmail_id": mid} for mid in new_ids]

    with get_session() as db:
        pending = (
            db.query(Email)
            .filter(~exists().where(Offer.email_id == Email.id))
            .order_by(Email.id.asc())
            .all()
        )
        items += [
            {"kind": "pending", "email_id": e.id, "subject": e.subject, "body": e.body or ""}
            for e in pending
        ]

    return session, items


def _process_new(gmail_session, gmail_id: str) -> tuple[str, str]:
    """Fetch + store + analyse a not-yet-seen Gmail message. Returns (outcome, subject)."""
    from gmail.gmail_service import fetch_single_message

    raw = retry_with_backoff(
        lambda: fetch_single_message(gmail_session, gmail_id),
        label=f"Gmail fetch {gmail_id}",
    )
    subject = raw["subject"]

    with get_session() as db:
        # another item in the same batch (or a concurrent request) may have saved this
        # message already — skip rather than violate the unique constraint.
        if db.query(Email.id).filter(Email.gmail_message_id == gmail_id).first():
            return "skipped", subject

        email_row = Email(
            gmail_message_id=raw["gmail_message_id"],
            sender=raw["sender"],
            subject=subject,
            body=raw["body"],
            image_urls=json.dumps(raw["image_urls"]) if raw["image_urls"] else None,
            received_date=raw["received_date"],
            processed_at=datetime.utcnow(),
        )
        db.add(email_row)
        db.flush()
        email_id = email_row.id

    result = analyze_email(subject, raw["body"])
    if result is None:
        return "failed", subject

    with get_session() as db:
        db.add(_build_offer(email_id, result))
    return "success", subject


def _process_pending(email_id: int, subject: str, body: str) -> tuple[str, str]:
    result = analyze_email(subject, body)
    if result is None:
        return "failed", subject
    with get_session() as db:
        db.add(_build_offer(email_id, result))
    return "success", subject


def _run_one(job_id: int, gmail_session, item: dict) -> None:
    if job_service.is_cancel_requested(job_id):
        job_service.update_progress(job_id, skipped_delta=1)
        return

    try:
        if item["kind"] == "new":
            outcome, subject = _process_new(gmail_session, item["gmail_id"])
        else:
            outcome, subject = _process_pending(item["email_id"], item["subject"], item["body"])
    except Exception as exc:
        outcome, subject = "failed", item.get("subject") or item.get("gmail_id", "?")
        logger.error("email_sync: error processing %s: %s", subject, exc)
        job_service.append_log(job_id, f"Failed to analyse \"{subject[:60]}\" — {exc}")
        job_service.update_progress(job_id, processed_delta=1, failed_delta=1, current_email_subject=subject)
        return

    with _progress_lock:
        if outcome == "success":
            job_service.append_log(job_id, f"✓ \"{subject[:60]}\" analysed and saved")
            job_service.update_progress(job_id, processed_delta=1, successful_delta=1, current_email_subject=subject)
        elif outcome == "skipped":
            job_service.update_progress(job_id, processed_delta=1, skipped_delta=1, current_email_subject=subject)
        else:
            job_service.append_log(job_id, f"✗ Failed to analyse \"{subject[:60]}\"")
            job_service.update_progress(job_id, processed_delta=1, failed_delta=1, current_email_subject=subject)


def run_email_sync_job(job_id: int, worker_count: int) -> None:
    try:
        job_service.append_log(job_id, "Connecting to Gmail…")
        gmail_session, items = _collect_work_items()
        job_service.append_log(job_id, f"Found {len(items)} email(s) to process.")
        job_service.mark_running(job_id, total_emails=len(items))

        if not items:
            job_service.finish_job(job_id, "completed")
            job_service.append_log(job_id, "Nothing new — already up to date.")
            return

        with ThreadPoolExecutor(max_workers=max(1, worker_count)) as pool:
            futures = [pool.submit(_run_one, job_id, gmail_session, item) for item in items]
            for future in as_completed(futures):
                future.result()  # surface unexpected exceptions in logs below via except

                if job_service.is_cancel_requested(job_id):
                    for f in futures:
                        f.cancel()  # only affects not-yet-started futures

        cancelled = job_service.is_cancel_requested(job_id)
        if cancelled:
            job_service.append_log(job_id, "Cancelled by user.")
            job_service.finish_job(job_id, "cancelled")
        else:
            job = job_service.get_job(job_id)
            job_service.append_log(
                job_id,
                f"Done — {job['successful']} succeeded, {job['failed']} failed, {job['skipped']} skipped.",
            )
            job_service.finish_job(job_id, "completed")
    except Exception as exc:
        logger.error("email_sync job %s crashed: %s", job_id, exc)
        job_service.append_log(job_id, f"Error: {exc}")
        job_service.finish_job(job_id, "failed", error=str(exc))
