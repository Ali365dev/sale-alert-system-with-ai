"""Concurrency gate + queue for website_scrape_brand jobs.

Scrape-now always enqueues a pending job. Up to WEBSITE_SCRAPE_MAX_CONCURRENT
jobs run at once; the rest wait and auto-start when a slot frees. On API
restart, orphaned active rows are failed so slots are not stuck forever.
"""
from __future__ import annotations

import threading

from config import WEBSITE_SCRAPE_MAX_CONCURRENT, WEBSITE_SCRAPE_STALE_MINUTES, logger
from services import job_runner, job_service

_JOB_TYPE = "website_scrape_brand"
_lock = threading.Lock()
_started_ids: set[int] = set()


def fail_orphaned_on_startup() -> int:
    """Fail scrapes left active by a previous process (threads are gone)."""
    failed = job_service.fail_active_jobs(
        _JOB_TYPE,
        "Server restarted — previous website scrape interrupted. Retry if needed.",
    )
    if failed:
        logger.info("Reclaimed %s orphaned website scrape job(s) on startup", len(failed))
    return len(failed)


def reclaim_unowned_workers() -> int:
    """Fail DB rows marked running/cancelling that this process is not running.

    Pending queued jobs are left alone so scrape-all can stack up safely.
    """
    with _lock:
        owned = set(_started_ids)

    failed = job_service.fail_jobs(
        _JOB_TYPE,
        "Website scrape worker lost (process restarted or hung) — "
        "marked failed so a new scrape can start.",
        statuses=("running", "cancelling"),
        exclude_ids=owned,
    )
    if failed:
        logger.info("Reclaimed %s unowned website scrape worker(s)", len(failed))
    return len(failed)


def reclaim_and_dispatch() -> int:
    """Fail stale/orphaned jobs, then start pending scrapes up to the cap."""
    reclaim_unowned_workers()
    job_service.reclaim_stale_jobs(_JOB_TYPE, WEBSITE_SCRAPE_STALE_MINUTES)
    return dispatch_pending()


def dispatch_pending() -> int:
    """Start oldest pending website scrapes until the concurrent cap is full.

    Slot accounting uses in-process ``_started_ids`` (not DB running count)
    so concurrent scrape-now requests cannot oversubscribe before
    ``mark_running`` lands.
    """
    started = 0
    with _lock:
        slots = max(0, int(WEBSITE_SCRAPE_MAX_CONCURRENT) - len(_started_ids))
        if slots <= 0:
            return 0

        pending = job_service.list_pending_jobs(_JOB_TYPE, limit=slots + len(_started_ids))
        runner = job_runner.get_runner(_JOB_TYPE)
        if runner is None:
            logger.error("No runner registered for %s", _JOB_TYPE)
            return 0

        for job in pending:
            if started >= slots:
                break
            job_id = job["id"]
            if job_id in _started_ids:
                continue
            _started_ids.add(job_id)
            payload = job.get("payload") or {}
            threading.Thread(
                target=_run_and_dispatch_next,
                args=(runner, job_id, payload),
                daemon=True,
                name=f"website-scrape-{job_id}",
            ).start()
            started += 1
    return started


def _run_and_dispatch_next(runner, job_id: int, payload: dict) -> None:
    try:
        runner.run(job_id, payload)
    finally:
        with _lock:
            _started_ids.discard(job_id)
        try:
            dispatch_pending()
        except Exception:
            logger.exception("Failed to dispatch next website scrape after job %s", job_id)
