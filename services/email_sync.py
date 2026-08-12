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

from ai.analyzer import analyze_email, build_offer
from config import logger
from database.db import get_session
from database.models import Email, Offer
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
            {
                "kind": "pending",
                "email_id": e.id,
                "subject": e.subject,
                "body": e.body or "",
                "sender": e.sender or "",
                "image_urls": json.loads(e.image_urls) if e.image_urls else [],
            }
            for e in pending
        ]

    return session, items


def _analyze_and_save(job_id: int, email_id: int, subject: str, body: str, sender: str, image_urls: list[str]) -> str:
    """Shared gate + OCR + AI-analysis + offer-save tail, used by both the
    just-fetched and already-stored-but-pending paths below."""
    from ai.ocr import extract_and_merge
    from services.jobs.discover_brand import extract_domain, find_known_brand_by_domain, route_to_candidate_queue

    # Same deterministic sender-domain gate as the other pipelines
    # (services/jobs/process_pending.py, services/email_processing.py): an
    # email from a sender that isn't a known Brand's domain never reaches AI
    # analysis / gets an Offer — it's routed to the Unknown Emails review
    # queue instead, so an unresolved sender never ends up with an
    # AI-guessed brand name sitting on an Offer with no matching Brand row.
    sender_domain = extract_domain(sender)
    if find_known_brand_by_domain(sender_domain) is None:
        route_to_candidate_queue(email_id, sender, sender_domain)
        job_service.append_log(
            job_id, f"↷ \"{subject[:60]}\" routed to Unknown Emails (sender not matched to a known brand)",
            severity="warning", category="ai",
        )
        _mark_processing_result(email_id, "failed", "No matching brand — routed to Unknown Emails")
        return "skipped"

    ocr_result = extract_and_merge(subject, body, image_urls)
    with get_session() as db:
        e = db.query(Email).filter(Email.id == email_id).first()
        if e is not None:
            e.ocr_text_raw = ocr_result["ocr_raw"] or None
            e.ocr_text_clean = ocr_result["ocr_clean"] or None
            e.ocr_processed_at = datetime.utcnow()

    result = analyze_email(subject, ocr_result["merged"], sender)
    if result is None:
        _mark_processing_result(email_id, "failed", "AI returned no result")
        return "failed"

    with get_session() as db:
        db.add(build_offer(email_id, result))
    _mark_processing_result(email_id, "processed", None)
    return "success"


def _process_new(job_id: int, gmail_session, gmail_id: str) -> tuple[str, str]:
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

    outcome = _analyze_and_save(job_id, email_id, subject, raw["body"], raw["sender"], raw["image_urls"])
    return outcome, subject


def _process_pending(job_id: int, email_id: int, subject: str, body: str, sender: str, image_urls: list[str]) -> tuple[str, str]:
    outcome = _analyze_and_save(job_id, email_id, subject, body, sender, image_urls)
    return outcome, subject


def _mark_processing_result(email_id: int, status: str, error: str | None) -> None:
    with get_session() as db:
        e = db.query(Email).filter(Email.id == email_id).first()
        if e is not None:
            e.processing_status = status
            e.processing_error = error
            e.processing_attempted_at = datetime.utcnow()


def _run_one(job_id: int, gmail_session, item: dict, critical: dict, critical_event: threading.Event) -> None:
    if job_service.is_cancel_requested(job_id):
        job_service.update_progress(job_id, skipped_delta=1)
        return
    if critical_event.is_set():
        return  # a sibling worker already hit a critical error — stop doing new work

    try:
        if item["kind"] == "new":
            outcome, subject = _process_new(job_id, gmail_session, item["gmail_id"])
        else:
            outcome, subject = _process_pending(
                job_id, item["email_id"], item["subject"], item["body"], item["sender"], item["image_urls"]
            )
    except Exception as exc:
        # Any exception escaping fetch/analyse here (Gmail auth/API failure, retry-limit
        # exceeded, DB errors) is treated as critical — per-email AI failures are already
        # handled as a graceful "failed" outcome above, not an exception.
        subject = item.get("subject") or item.get("gmail_id", "?")
        logger.error("email_sync: critical error processing %s: %s", subject, exc)
        job_service.append_log(job_id, f"✗ Fatal error on \"{subject[:60]}\" — {exc}", severity="error", category="gmail")
        job_service.update_progress(job_id, processed_delta=1, failed_delta=1, current_email_subject=subject, current_item_label=subject)
        critical["exc"] = exc
        critical_event.set()
        return

    with _progress_lock:
        if outcome == "success":
            job_service.append_log(job_id, f"✓ \"{subject[:60]}\" analysed and saved", severity="success", category="ai")
            job_service.update_progress(job_id, processed_delta=1, successful_delta=1, current_email_subject=subject, current_item_label=subject)
        elif outcome == "skipped":
            job_service.update_progress(job_id, processed_delta=1, skipped_delta=1, current_email_subject=subject, current_item_label=subject)
        else:
            job_service.append_log(job_id, f"✗ Failed to analyse \"{subject[:60]}\"", severity="warning", category="ai")
            job_service.update_progress(job_id, processed_delta=1, failed_delta=1, current_email_subject=subject, current_item_label=subject)


def run_email_sync_job(job_id: int, worker_count: int) -> None:
    critical: dict = {"exc": None}
    critical_event = threading.Event()
    try:
        job_service.set_stage(job_id, "connecting")
        job_service.append_log(job_id, "Connecting to Gmail…", category="gmail")
        gmail_session, items = _collect_work_items()
        job_service.append_log(job_id, f"Found {len(items)} email(s) to process.", category="gmail")
        job_service.mark_running(job_id, total_emails=len(items), total_items=len(items))
        job_service.set_stage(job_id, "processing")

        if not items:
            job_service.set_stage(job_id, "completed")
            job_service.finish_job(job_id, "completed")
            job_service.append_log(job_id, "Nothing new — already up to date.", severity="success")
            return

        with ThreadPoolExecutor(max_workers=max(1, worker_count)) as pool:
            futures = [pool.submit(_run_one, job_id, gmail_session, item, critical, critical_event) for item in items]
            for future in as_completed(futures):
                future.result()  # surface unexpected exceptions (bugs in _run_one itself)

                if job_service.is_cancel_requested(job_id) or critical_event.is_set():
                    for f in futures:
                        f.cancel()  # only affects not-yet-started futures; in-flight ones drain

        job_service.set_stage(job_id, "finalizing")

        if critical_event.is_set():
            job_service.append_log(job_id, "Stopped — critical error.", severity="error", category="system")
            job_service.finish_job(job_id, "failed", error=str(critical["exc"]))
        elif job_service.is_cancel_requested(job_id):
            job_service.append_log(job_id, "Cancelled by user.", severity="warning")
            job_service.finish_job(job_id, "cancelled")
        else:
            job = job_service.get_job(job_id)
            job_service.append_log(
                job_id,
                f"Done — {job['successful']} succeeded, {job['failed']} failed, {job['skipped']} skipped.",
                severity="success",
            )
            job_service.set_stage(job_id, "completed")
            job_service.finish_job(job_id, "completed")
    except Exception as exc:
        logger.error("email_sync job %s crashed: %s", job_id, exc)
        job_service.append_log(job_id, f"Error: {exc}", severity="error", category="system")
        job_service.finish_job(job_id, "failed", error=str(exc))
