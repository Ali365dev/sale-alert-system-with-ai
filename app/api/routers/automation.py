"""Automatic new-email pipeline — the Gmail Pub/Sub push webhook (fast
trigger) and admin job-introspection endpoints. The actual pipeline work
(fetch/label/analyze/offer/notify) never runs on this request thread — see
services/jobs/email_automation.py, dispatched via _start_automation_job_if_needed
below, the same threading.Thread pattern every other job type uses."""
import threading

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from app.core.security import require_admin
from services import job_runner, job_service
from services.settings_service import get_setting

router = APIRouter(prefix="/api/gmail", tags=["automation"])
admin_router = APIRouter(prefix="/api/automation", tags=["automation"], dependencies=[Depends(require_admin)])

JOB_TYPE = "email_automation"


def _start_automation_job_if_needed() -> dict | None:
    """Shared dispatch used by both the webhook and the scheduler backstop
    (services/scheduler.py::check_gmail_for_changes) — exactly one code
    path for "start an automation job." Returns the created job dict, or
    None if automation is off or a run is already active (never more than
    one email_automation job at a time — collect_work's history-based
    discovery already covers anything a second concurrent run would find)."""
    if not get_setting("automatic_email_processing", default=False):
        return None

    existing = job_service.get_active_job(JOB_TYPE)
    if existing:
        return None

    config = job_runner.get_runner(JOB_TYPE)
    if config is None:
        return None

    job = job_service.create_job(JOB_TYPE, payload={})
    threading.Thread(target=config.run, args=(job["id"], {}), daemon=True).start()
    return job


@router.post("/webhook")
def gmail_webhook(token: str = Query("")):
    """Google Cloud Pub/Sub push endpoint — Gmail publishes here (via the
    topic configured in the gmail_pubsub_topic setting) whenever the watched
    mailbox changes. Must respond fast: Pub/Sub retries (and eventually
    dead-letters) a push that doesn't get a 2xx quickly, and any real work
    here would block on network/AI calls this endpoint has no business
    waiting on — see _start_automation_job_if_needed, which only ever
    spawns a thread and returns immediately."""
    expected = get_setting("gmail_webhook_secret", default="")
    if not expected or token != expected:
        # Deliberately 200, not 401/403: an unrecognized token is either a
        # misconfigured subscription or a stray request, neither of which
        # Pub/Sub should retry — but the response body makes it obvious in
        # logs that nothing was dispatched.
        return JSONResponse({"status": "ignored"}, status_code=200)

    # The push envelope's own payload (base64-encoded {"emailAddress",
    # "historyId"}) is deliberately not parsed — the actual "what's new"
    # answer always comes from history.list against our own stored cursor
    # (see EmailAutomationJob.collect_work), never trusted from the
    # envelope itself, since Gmail notifications can coalesce or arrive out
    # of order. The notification's only job is "something changed, go look."
    _start_automation_job_if_needed()
    return {"status": "received"}


@admin_router.get("/config")
def automation_config():
    """Everything an admin needs to finish the one-time Pub/Sub setup (see
    the migration plan's "External setup required" section) — in
    particular gmail_webhook_secret, which only ever appears here, not in
    the generic Settings GET/PUT (see app/api/routers/settings.py's
    _EMAIL_PROCESSING_KEYS comment)."""
    return {
        "automatic_email_processing": get_setting("automatic_email_processing", default=False),
        "gmail_pubsub_topic": get_setting("gmail_pubsub_topic", default=""),
        "gmail_webhook_secret": get_setting("gmail_webhook_secret", default=""),
        "gmail_last_history_id": get_setting("gmail_last_history_id", default=""),
        "gmail_watch_expiration": get_setting("gmail_watch_expiration", default=""),
    }


@admin_router.get("/jobs")
def list_automation_jobs(
    status: str | None = Query(None),
    limit: int = Query(50),
    offset: int = Query(0),
):
    jobs, total = job_service.list_jobs(job_type=JOB_TYPE, status=status, limit=limit, offset=offset)
    return {"jobs": jobs, "total": total}


@admin_router.get("/jobs/{job_id}")
def get_automation_job(job_id: int):
    job = job_service.get_job(job_id)
    if job is None or job["job_type"] != JOB_TYPE:
        return JSONResponse({"error": "not found"}, status_code=404)
    return job
