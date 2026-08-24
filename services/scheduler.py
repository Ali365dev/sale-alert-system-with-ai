"""Process-local scheduler for the offer-retention cleanup job and the
automatic-new-email backstop poll.

Uses APScheduler (already present in the environment) rather than introducing
a second scheduling mechanism. In-process, matching the rest of this app's
single-process/multi-thread deployment model (see app/main.py — Uvicorn,
single worker process) — no extra infrastructure (Celery, cron, etc.) needed.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from config import GMAIL_AUTOMATION_POLL_MINUTES, OFFER_CLEANUP_HOUR_UTC, logger

_scheduler: BackgroundScheduler | None = None


def _run_cleanup_job() -> None:
    from services.cleanup import cleanup_expired_offers

    try:
        cleanup_expired_offers()
    except Exception:
        logger.exception("Scheduled offer cleanup failed")


def check_gmail_for_changes() -> None:
    """The scheduler backstop for the automatic new-email pipeline (see
    services/jobs/email_automation.py and app/api/routers/automation.py).

    Deliberately kept cheap — this runs on APScheduler's own thread pool,
    shared with the cleanup job above, so it must never block on the actual
    fetch/label/analyze/offer/notify pipeline. It does at most one or two
    lightweight Gmail REST calls (never `history.list`, which is what
    actually enumerates messages — that's the job's job, not the
    scheduler's) and returns:
      1. If automation is off, return immediately — no Gmail call at all.
      2. ensure_gmail_watch_active() — a no-op unless the watch is missing
         or expiring soon, in which case it makes one `watch` call.
      3. One `get_mailbox_profile()` call to compare the mailbox's current
         historyId against our stored cursor. Unchanged -> nothing new,
         return. Changed -> hand off to the job system and return; all
         actual processing happens on the job's own thread.
    """
    from gmail.gmail_service import (
        _get_session,
        ensure_gmail_watch_active,
        get_mailbox_profile,
    )
    from services.settings_service import get_setting

    if not get_setting("automatic_email_processing", default=False):
        return

    try:
        ensure_gmail_watch_active()

        last_known = get_setting("gmail_last_history_id", default="")
        if not last_known:
            return  # ensure_gmail_watch_active() just seeded it; next tick will see it

        profile = get_mailbox_profile(_get_session())
        if str(profile.get("historyId")) == str(last_known):
            return  # nothing new

        from app.api.routers.automation import _start_automation_job_if_needed
        _start_automation_job_if_needed()
    except Exception:
        logger.exception("Gmail change-check failed")


def start_scheduler() -> BackgroundScheduler:
    """Idempotent — safe to call more than once (e.g. Flask debug reloader)."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    scheduler = BackgroundScheduler(timezone="UTC")
    scheduler.add_job(
        _run_cleanup_job,
        trigger=CronTrigger(hour=OFFER_CLEANUP_HOUR_UTC, minute=0),
        id="cleanup_expired_offers",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        check_gmail_for_changes,
        trigger=IntervalTrigger(minutes=GMAIL_AUTOMATION_POLL_MINUTES),
        id="check_gmail_for_changes",
        replace_existing=True,
        misfire_grace_time=60,
        max_instances=1,
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info(
        "Scheduler started — offer cleanup runs daily at %02d:00 UTC, Gmail change-check every %d minute(s)",
        OFFER_CLEANUP_HOUR_UTC, GMAIL_AUTOMATION_POLL_MINUTES,
    )
    return scheduler
