"""Process-local daily scheduler for the offer-retention cleanup job.

Uses APScheduler (already present in the environment) rather than introducing
a second scheduling mechanism. In-process, matching the rest of this app's
single-process/multi-thread deployment model (see app/main.py — Uvicorn,
single worker process) — no extra infrastructure (Celery, cron, etc.) needed.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from config import OFFER_CLEANUP_HOUR_UTC, logger

_scheduler: BackgroundScheduler | None = None


def _run_cleanup_job() -> None:
    from services.cleanup import cleanup_expired_offers

    try:
        cleanup_expired_offers()
    except Exception:
        logger.exception("Scheduled offer cleanup failed")


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
    scheduler.start()
    _scheduler = scheduler
    logger.info("Scheduler started — offer cleanup runs daily at %02d:00 UTC", OFFER_CLEANUP_HOUR_UTC)
    return scheduler
