"""CRUD + progress helpers for the persisted Job / JobLog tables.

Every write goes through a fresh `get_session()` so it's safe to call from any
worker thread — each call opens, commits, and closes its own SQLAlchemy
session rather than sharing one across threads.

Field-naming note: `total_emails`/`processed_emails`/`current_email_subject`
are the original email-sync-only columns, kept for back-compat. Every other
job type (and any code that doesn't care which type it's dealing with) should
use the generic `total_items`/`processed_items`/`current_item_label` columns
instead — see `update_progress`/`mark_running`, which write both when given
generic values.
"""
import json
from datetime import datetime, timezone

from sqlalchemy import func

from database.db import get_session
from database.models import Brand, Email, Job, JobLog, Offer

_LOG_KEEP = 500  # trim job_logs beyond this many rows per job, oldest first
_LOG_RETURN_LIMIT = 200


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _today_start():
    now = _utcnow()
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def _dumps(value) -> str | None:
    return json.dumps(value) if value is not None else None


def _loads(value: str | None):
    if not value:
        return None
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return None


def get_active_job(job_type: str) -> dict | None:
    with get_session() as session:
        job = (
            session.query(Job)
            .filter(Job.job_type == job_type, Job.status.in_(["pending", "running", "cancelling"]))
            .order_by(Job.id.desc())
            .first()
        )
        return _job_to_dict(job) if job else None


def create_job(job_type: str, worker_count: int = 5, payload: dict | None = None) -> dict:
    with get_session() as session:
        job = Job(job_type=job_type, status="pending", worker_count=worker_count, payload=_dumps(payload))
        session.add(job)
        session.flush()
        job_id = job.id
        return _job_to_dict(job) | {"id": job_id}


def get_job(job_id: int) -> dict | None:
    with get_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        return _job_to_dict(job) if job else None


def get_job_logs(job_id: int, since_id: int = 0, full: bool = False) -> list[dict]:
    with get_session() as session:
        q = session.query(JobLog).filter(JobLog.job_id == job_id)
        if since_id:
            q = q.filter(JobLog.id > since_id)
        q = q.order_by(JobLog.id.desc())
        if not full:
            q = q.limit(_LOG_RETURN_LIMIT)
        rows = q.all()
        return [
            {
                "id": r.id,
                "time": r.created_at.isoformat(),
                "message": r.message,
                "severity": r.severity,
                "category": r.category,
            }
            for r in reversed(rows)
        ]


def append_log(job_id: int, message: str, severity: str = "info", category: str | None = None) -> None:
    with get_session() as session:
        session.add(JobLog(job_id=job_id, message=message, severity=severity, category=category))
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


def set_stage(job_id: int, stage: str) -> None:
    with get_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if job:
            job.stage = stage


def set_checkpoint(job_id: int, item_id, item_label: str) -> None:
    with get_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if job:
            job.checkpoint = _dumps({"last_item_id": item_id, "last_item_label": item_label})


def set_result(job_id: int, result: dict) -> None:
    with get_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if job:
            job.result = _dumps(result)


def mark_running(job_id: int, total_emails: int = 0, total_items: int = 0) -> None:
    with get_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "running"
            if total_emails:
                job.total_emails = total_emails
            if total_items:
                job.total_items = total_items
            job.started_at = _utcnow()


def update_progress(
    job_id: int,
    *,
    processed_delta: int = 0,
    successful_delta: int = 0,
    failed_delta: int = 0,
    skipped_delta: int = 0,
    current_email_subject: str | None = None,
    current_item_label: str | None = None,
) -> None:
    with get_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return
        job.processed_emails += processed_delta
        job.processed_items += processed_delta
        job.successful += successful_delta
        job.failed += failed_delta
        job.skipped += skipped_delta
        if current_email_subject is not None:
            job.current_email_subject = current_email_subject
        if current_item_label is not None:
            job.current_item_label = current_item_label

        total = job.total_items or job.total_emails
        processed = job.processed_items or job.processed_emails
        if total > 0:
            job.progress_percentage = round(100.0 * processed / total, 1)
            if job.started_at and processed > 0:
                elapsed = (_utcnow() - job.started_at).total_seconds()
                rate = elapsed / processed
                remaining_items = total - processed
                job.estimated_remaining_seconds = max(0.0, round(rate * remaining_items, 1))


def request_cancel(job_id: int) -> bool:
    """Returns False if the job isn't in a cancellable state."""
    with get_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job or job.status not in ("pending", "running"):
            return False
        job.cancel_requested = True
        job.status = "cancelling"
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
            job.current_item_label = None


def list_jobs(
    job_type: str | None = None,
    status: str | None = None,
    search: str | None = None,
    sort: str = "id",
    sort_dir: str = "desc",
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict], int]:
    with get_session() as session:
        q = session.query(Job)
        if job_type:
            q = q.filter(Job.job_type == job_type)
        if status:
            q = q.filter(Job.status == status)
        if search:
            like = f"%{search}%"
            q = q.filter((Job.job_type.ilike(like)) | (Job.current_item_label.ilike(like)))

        total = q.with_entities(func.count(Job.id)).scalar() or 0

        sort_col = {"id": Job.id, "started_at": Job.started_at, "finished_at": Job.finished_at, "status": Job.status}.get(sort, Job.id)
        q = q.order_by(sort_col.desc() if sort_dir != "asc" else sort_col.asc())
        rows = q.offset(offset).limit(limit).all()
        return [_job_to_dict(r) for r in rows], total


def bulk_delete(job_ids: list[int]) -> int:
    with get_session() as session:
        count = session.query(Job).filter(Job.id.in_(job_ids)).delete(synchronize_session=False)
        return count


def bulk_retry(job_ids: list[int]) -> list[dict]:
    return [job for job in (retry_job(jid) for jid in job_ids) if job is not None]


def delete_job(job_id: int) -> bool:
    with get_session() as session:
        job = session.query(Job).filter(Job.id == job_id).first()
        if not job:
            return False
        session.delete(job)
        return True


def retry_job(job_id: int) -> dict | None:
    with get_session() as session:
        old = session.query(Job).filter(Job.id == job_id).first()
        if not old or old.status not in ("failed", "cancelled"):
            return None
        payload = _loads(old.payload) or {}
        payload["retry_of"] = old.id
        new_job = Job(job_type=old.job_type, status="pending", worker_count=old.worker_count, payload=_dumps(payload))
        session.add(new_job)
        session.flush()
        return _job_to_dict(new_job)


def reconcile_interrupted_jobs() -> int:
    """Called once at startup: any job left pending/running/cancelling means the
    process died mid-run. Mark it failed+interrupted so Retry can pick it up —
    this app doesn't do true mid-item crash resume (see plan notes)."""
    with get_session() as session:
        stuck = session.query(Job).filter(Job.status.in_(["pending", "running", "cancelling"])).all()
        for job in stuck:
            job.status = "failed"
            job.is_interrupted = True
            job.error = "Interrupted by server restart"
            job.finished_at = _utcnow()
        return len(stuck)


def get_dashboard_summary() -> dict:
    today = _today_start()
    with get_session() as session:
        running = session.query(func.count(Job.id)).filter(Job.status.in_(["running", "cancelling"])).scalar() or 0
        queued = session.query(func.count(Job.id)).filter(Job.status == "pending").scalar() or 0

        finished_today = session.query(Job).filter(Job.finished_at >= today).all()
        completed_today = sum(1 for j in finished_today if j.status == "completed")
        failed_today = sum(1 for j in finished_today if j.status == "failed")
        cancelled_today = sum(1 for j in finished_today if j.status == "cancelled")

        durations = [
            (j.finished_at - j.started_at).total_seconds()
            for j in finished_today
            if j.started_at and j.finished_at
        ]
        avg_runtime_seconds = round(sum(durations) / len(durations), 1) if durations else 0.0

        speeds = []
        for j in finished_today:
            processed = j.processed_items or j.processed_emails
            if j.started_at and j.finished_at and processed:
                minutes = max((j.finished_at - j.started_at).total_seconds() / 60.0, 1e-6)
                speeds.append(processed / minutes)
        avg_processing_speed = round(sum(speeds) / len(speeds), 2) if speeds else 0.0

        finished_count = completed_today + failed_today + cancelled_today
        success_rate = round(100.0 * completed_today / finished_count, 1) if finished_count else 0.0
        failure_rate = round(100.0 * failed_today / finished_count, 1) if finished_count else 0.0

        emails_processed_today = session.query(func.count(Email.id)).filter(Email.processed_at >= today).scalar() or 0
        offers_generated_today = session.query(func.count(Offer.id)).filter(Offer.created_at >= today).scalar() or 0
        brands_researched_today = session.query(func.count(Brand.id)).filter(Brand.last_searched >= today).scalar() or 0

        per_type = []
        job_types = [row[0] for row in session.query(Job.job_type).distinct().all()]
        for jt in job_types:
            last = session.query(Job).filter(Job.job_type == jt, Job.finished_at.isnot(None)).order_by(Job.id.desc()).first()
            type_durations = [
                (j.finished_at - j.started_at).total_seconds()
                for j in session.query(Job).filter(Job.job_type == jt, Job.started_at.isnot(None), Job.finished_at.isnot(None)).order_by(Job.id.desc()).limit(20).all()
            ]
            per_type.append({
                "job_type": jt,
                "last_status": last.status if last else None,
                "last_finished_at": last.finished_at.isoformat() if last and last.finished_at else None,
                "avg_runtime_seconds": round(sum(type_durations) / len(type_durations), 1) if type_durations else None,
            })

        return {
            "running": running,
            "queued": queued,
            "completed_today": completed_today,
            "failed_today": failed_today,
            "emails_processed_today": emails_processed_today,
            "offers_generated_today": offers_generated_today,
            "brands_researched_today": brands_researched_today,
            "avg_runtime_seconds": avg_runtime_seconds,
            "avg_processing_speed": avg_processing_speed,
            "success_rate": success_rate,
            "failure_rate": failure_rate,
            "per_type": per_type,
        }


def _job_to_dict(job: Job) -> dict:
    total = job.total_items or job.total_emails
    processed = job.processed_items or job.processed_emails
    processing_speed = None
    if job.started_at and processed:
        end = job.finished_at or _utcnow()
        minutes = max((end - job.started_at).total_seconds() / 60.0, 1e-6)
        processing_speed = round(processed / minutes, 2)

    return {
        "id": job.id,
        "job_type": job.job_type,
        "status": job.status,
        "total_emails": job.total_emails,
        "processed_emails": job.processed_emails,
        "total_items": job.total_items,
        "processed_items": job.processed_items,
        "successful": job.successful,
        "failed": job.failed,
        "skipped": job.skipped,
        "current_email_subject": job.current_email_subject,
        "current_item_label": job.current_item_label,
        "stage": job.stage,
        "progress_percentage": job.progress_percentage,
        "estimated_remaining_seconds": job.estimated_remaining_seconds,
        "processing_speed": processing_speed,
        "worker_count": job.worker_count,
        "cancel_requested": job.cancel_requested,
        "error": job.error,
        "payload": _loads(job.payload),
        "result": _loads(job.result),
        "checkpoint": _loads(job.checkpoint),
        "is_interrupted": job.is_interrupted,
        "queue_position": job.queue_position,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
        "created_at": job.created_at.isoformat() if job.created_at else None,
    }
