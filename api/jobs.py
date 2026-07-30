"""Background job endpoints — generic start/monitor/cancel/retry/history for
every pipeline action registered in services/job_registry.py."""
import threading

from flask import Blueprint, jsonify, request

from services import job_runner, job_service

bp = Blueprint("jobs", __name__, url_prefix="/api/jobs")

EMAIL_SYNC_TYPE = "email_sync"
DEFAULT_WORKERS = 5
MAX_WORKERS = 10


def _dispatch(job_type: str, payload: dict):
    """Shared start logic: dedupe-guard, create the Job row, launch the job's
    run() (concurrent or sequential — the caller doesn't need to know which)
    on a background thread."""
    config = job_runner.get_runner(job_type)
    if config is None:
        return jsonify({"error": f"unknown job_type {job_type!r}"}), 404

    existing = job_service.get_active_job(job_type)
    if existing:
        return jsonify({"status": "already_running", "job": existing}), 409

    worker_count = DEFAULT_WORKERS
    if job_type == EMAIL_SYNC_TYPE:
        try:
            worker_count = max(1, min(MAX_WORKERS, int((payload or {}).get("workers", DEFAULT_WORKERS))))
        except (TypeError, ValueError):
            worker_count = DEFAULT_WORKERS

    job = job_service.create_job(job_type, worker_count=worker_count, payload=payload)
    threading.Thread(target=config.run, args=(job["id"], payload), daemon=True).start()
    return jsonify({"jobId": job["id"], "status": job["status"]}), 202


@bp.post("/<job_type>/start")
def start_job(job_type: str):
    payload = request.get_json(silent=True) or {}
    return _dispatch(job_type, payload)


@bp.post("/email-sync")
def start_email_sync():
    """Back-compat alias for the original email-sync-only route."""
    payload = request.get_json(silent=True) or {}
    return _dispatch(EMAIL_SYNC_TYPE, payload)


@bp.get("/summary")
def summary():
    return jsonify(job_service.get_dashboard_summary())


@bp.get("")
def history():
    job_type = request.args.get("job_type") or None
    status = request.args.get("status") or None
    search = request.args.get("search") or None
    sort = request.args.get("sort", "id")
    sort_dir = request.args.get("sort_dir", "desc")
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)
    jobs, total = job_service.list_jobs(
        job_type=job_type, status=status, search=search, sort=sort, sort_dir=sort_dir, limit=limit, offset=offset,
    )
    return jsonify({"jobs": jobs, "total": total})


@bp.get("/active")
def active_job():
    job_type = request.args.get("type", EMAIL_SYNC_TYPE)
    job = job_service.get_active_job(job_type)
    return jsonify({"job": job})


@bp.get("/<int:job_id>")
def get_job(job_id: int):
    job = job_service.get_job(job_id)
    if job is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(job)


@bp.get("/<int:job_id>/logs")
def get_job_logs(job_id: int):
    since_id = request.args.get("since", 0, type=int)
    full = request.args.get("full", "false").lower() == "true"
    return jsonify({"logs": job_service.get_job_logs(job_id, since_id, full=full)})


@bp.post("/<int:job_id>/cancel")
def cancel_job(job_id: int):
    ok = job_service.request_cancel(job_id)
    if not ok:
        return jsonify({"status": "not_cancellable"}), 409
    return jsonify({"status": "cancelling"})


@bp.post("/<int:job_id>/retry")
def retry_job_route(job_id: int):
    new_job = job_service.retry_job(job_id)
    if new_job is None:
        return jsonify({"error": "job is not retryable"}), 409

    config = job_runner.get_runner(new_job["job_type"])
    if config is None:
        return jsonify({"error": f"unknown job_type {new_job['job_type']!r}"}), 404

    threading.Thread(target=config.run, args=(new_job["id"], new_job["payload"] or {}), daemon=True).start()
    return jsonify({"jobId": new_job["id"], "status": new_job["status"]}), 202


@bp.delete("/<int:job_id>")
def delete_job_route(job_id: int):
    ok = job_service.delete_job(job_id)
    if not ok:
        return jsonify({"error": "not found"}), 404
    return jsonify({"status": "deleted"})


@bp.post("/bulk")
def bulk_action():
    body = request.get_json(silent=True) or {}
    action = body.get("action")
    ids = body.get("ids") or []
    if action == "delete":
        count = job_service.bulk_delete(ids)
        return jsonify({"status": "deleted", "count": count})
    if action == "retry":
        new_jobs = job_service.bulk_retry(ids)
        for job in new_jobs:
            config = job_runner.get_runner(job["job_type"])
            if config:
                threading.Thread(target=config.run, args=(job["id"], job["payload"] or {}), daemon=True).start()
        return jsonify({"status": "retried", "jobs": new_jobs})
    return jsonify({"error": f"unknown bulk action {action!r}"}), 400
