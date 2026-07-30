"""Background job endpoints — start/monitor/cancel the email-sync pipeline."""
import threading

from flask import Blueprint, jsonify, request

from services import job_service

bp = Blueprint("jobs", __name__, url_prefix="/api/jobs")

EMAIL_SYNC_TYPE = "email_sync"
DEFAULT_WORKERS = 5
MAX_WORKERS = 10


@bp.post("/email-sync")
def start_email_sync():
    from services.email_sync import run_email_sync_job

    existing = job_service.get_active_job(EMAIL_SYNC_TYPE)
    if existing:
        return jsonify({"status": "already_running", "job": existing}), 409

    workers = request.get_json(silent=True) or {}
    worker_count = workers.get("workers", DEFAULT_WORKERS)
    try:
        worker_count = max(1, min(MAX_WORKERS, int(worker_count)))
    except (TypeError, ValueError):
        worker_count = DEFAULT_WORKERS

    job = job_service.create_job(EMAIL_SYNC_TYPE, worker_count)
    threading.Thread(target=run_email_sync_job, args=(job["id"], worker_count), daemon=True).start()
    return jsonify({"jobId": job["id"], "status": job["status"]}), 202


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
    return jsonify({"logs": job_service.get_job_logs(job_id, since_id)})


@bp.post("/<int:job_id>/cancel")
def cancel_job(job_id: int):
    ok = job_service.request_cancel(job_id)
    if not ok:
        return jsonify({"status": "not_cancellable"}), 409
    return jsonify({"status": "cancelling"})
