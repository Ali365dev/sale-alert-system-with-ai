"""CRUD + progress helpers for the persisted Job / JobLog tables.

Every write goes through a fresh `get_session()` so it's safe to call from any
worker thread — each call opens, commits, and closes its own SQLAlchemy
session rather than sharing one across threads.
"""
from datetime import datetime, timezone

from database.db import get_session
from database.models import Job, JobLog

_LOG_KEEP = 500  # trim job_logs beyond this many rows per job, oldest first
_LOG_RETURN_LIMIT = 200


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def get_active_job(job_type: str) -> dict | None:
    with get_session() as session:
        job = (
            session.query(Job)
            .filter(Job.job_type == job_type, Job.status.in_(["pending", "running"]))
            .order_by(Job.id.desc())
            .first()
        )
        return _job_to_dict(job) if job else None


def create_job(job_type: str, worker_count: int) -> dict:
    with get_session() as session:
        job = Job(job_type=job_type, status="pending", worker_count=worker_count)
        session.add(job)
        session.flush()
        job_id = job.id
        return _job_to_dict(job) | {"id": job_id}


def get_job(job_id: int) -> dict | None:
    with get_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        return _job_to_dict(job) if job else None


def get_job_logs(job_id: int, since_id: int = 0) -> list[dict]:
    with get_session() as session:
        q = session.query(JobLog).filter(JobLog.job_id == job_id)
        if since_id:
            q = q.filter(JobLog.id > since_id)
        rows = q.order_by(JobLog.id.desc()).limit(_LOG_RETURN_LIMIT).all()
        return [
            {"id": r.id, "time": r.created_at.isoformat(), "message": r.message}
            for r in reversed(rows)
        ]


def append_log(job_id: int, message: str) -> None:
    with get_session() as session:
        session.add(JobLog(job_id=job_id, message=message))
        # keep the log table bounded for long-running / repeated jobs
        excess = (
            session.query(JobLog)
            .filter(JobLog.job_id == job_id)
            .order_by(JobLog.id.desc())
            .offset(_LOG_KEEP)
            .all()
        )
        for row in excess:
            session.delete(row)


def mark_running(job_id: int, total_emails: int) -> None:
    with get_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "running"
            job.total_emails = total_emails
            job.started_at = _utcnow()


def update_progress(
    job_id: int,
    *,
    processed_delta: int = 0,
    successful_delta: int = 0,
    failed_delta: int = 0,
    skipped_delta: int = 0,
    current_email_subject: str | None = None,
) -> None:
    with get_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
        job.processed_emails += processed_delta
        job.successful += successful_delta
        job.failed += failed_delta
        job.skipped += skipped_delta
        if current_email_subject is not None:
            job.current_email_subject = current_email_subject

        if job.total_emails > 0:
            job.progress_percentage = round(100.0 * job.processed_emails / job.total_emails, 1)
            if job.started_at and job.processed_emails > 0:
                elapsed = (_utcnow() - job.started_at).total_seconds()
                rate = elapsed / job.processed_emails
                remaining_items = job.total_emails - job.processed_emails
                job.estimated_remaining_seconds = max(0.0, round(rate * remaining_items, 1))


def request_cancel(job_id: int) -> bool:
    """Returns False if the job isn't in a cancellable state."""
    with get_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job or job.status not in ("pending", "running"):
            return False
        job.cancel_requested = True
        return True


def is_cancel_requested(job_id: int) -> bool:
    with get_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        return bool(job and job.cancel_requested)


def finish_job(job_id: int, status: str, error: str | None = None) -> None:
    with get_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = status
            job.error = error
            job.finished_at = _utcnow()
            job.estimated_remaining_seconds = 0.0
            job.current_email_subject = None


def _job_to_dict(job: Job) -> dict:
    return {
        "id": job.id,
        "job_type": job.job_type,
        "status": job.status,
        "total_emails": job.total_emails,
        "processed_emails": job.processed_emails,
        "successful": job.successful,
        "failed": job.failed,
        "skipped": job.skipped,
        "current_email_subject": job.current_email_subject,
        "progress_percentage": job.progress_percentage,
        "estimated_remaining_seconds": job.estimated_remaining_seconds,
        "worker_count": job.worker_count,
        "cancel_requested": job.cancel_requested,
        "error": job.error,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }
