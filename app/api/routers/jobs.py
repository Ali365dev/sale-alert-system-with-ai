"""Background job endpoints — generic start/monitor/cancel/retry/history for
every pipeline action registered in services/job_registry.py. Ported from
api/jobs.py — logic, response shapes, and the send_push_notification
admin-only guard are unchanged."""
import threading

from fastapi import APIRouter, Body, Query, Request
from fastapi.responses import JSONResponse

from services import job_runner, job_service, settings_auth

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

EMAIL_SYNC_TYPE = "email_sync"
DEFAULT_WORKERS = 5
MAX_WORKERS = 10

# See api/jobs.py's original docstring for the full rationale: every other
# job type is an internal pipeline action (fine unauthenticated); this one
# fans a message out to every real device, so it must not be startable or
# re-triggerable via retry/bulk-retry by an arbitrary caller.
_ADMIN_ONLY_JOB_TYPES = {"send_push_notification"}


def _require_admin_for(job_type: str, request: Request):
    if job_type in _ADMIN_ONLY_JOB_TYPES and not settings_auth.verify_session_token(
        request.cookies.get(settings_auth.SESSION_COOKIE)
    ):
        return JSONResponse({"error": "not authenticated"}, status_code=401)
    return None


def _dispatch(job_type: str, payload: dict, request: Request):
    config = job_runner.get_runner(job_type)
    if config is None:
        return JSONResponse({"error": f"unknown job_type {job_type!r}"}, status_code=404)

    guard = _require_admin_for(job_type, request)
    if guard:
        return guard

    existing = job_service.get_active_job(job_type)
    if existing:
        return JSONResponse({"status": "already_running", "job": existing}, status_code=409)

    worker_count = DEFAULT_WORKERS
    if job_type == EMAIL_SYNC_TYPE:
        try:
            worker_count = max(1, min(MAX_WORKERS, int((payload or {}).get("workers", DEFAULT_WORKERS))))
        except (TypeError, ValueError):
            worker_count = DEFAULT_WORKERS

    job = job_service.create_job(job_type, worker_count=worker_count, payload=payload)
    threading.Thread(target=config.run, args=(job["id"], payload), daemon=True).start()
    return JSONResponse({"jobId": job["id"], "status": job["status"]}, status_code=202)


@router.post("/{job_type}/start")
def start_job(job_type: str, request: Request, payload: dict = Body(default={})):
    return _dispatch(job_type, payload or {}, request)


@router.post("/email-sync")
def start_email_sync(request: Request, payload: dict = Body(default={})):
    """Back-compat alias for the original email-sync-only route."""
    return _dispatch(EMAIL_SYNC_TYPE, payload or {}, request)


@router.get("/summary")
def summary():
    return job_service.get_dashboard_summary()


@router.get("")
def history(
    job_type: str | None = Query(None),
    status: str | None = Query(None),
    search: str | None = Query(None),
    sort: str = Query("id"),
    sort_dir: str = Query("desc"),
    limit: int = Query(50),
    offset: int = Query(0),
):
    jobs, total = job_service.list_jobs(
        job_type=job_type, status=status, search=search, sort=sort, sort_dir=sort_dir, limit=limit, offset=offset,
    )
    return {"jobs": jobs, "total": total}


@router.get("/active")
def active_job(type: str = Query(EMAIL_SYNC_TYPE)):  # noqa: A002 — matches original query param name
    job = job_service.get_active_job(type)
    return {"job": job}


@router.get("/{job_id}")
def get_job(job_id: int):
    job = job_service.get_job(job_id)
    if job is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return job


@router.get("/{job_id}/logs")
def get_job_logs(job_id: int, since: int = Query(0), full: str = Query("false")):
    logs = job_service.get_job_logs(job_id, since, full=full.lower() == "true")
    return {"logs": logs}


@router.post("/{job_id}/cancel")
def cancel_job(job_id: int):
    ok = job_service.request_cancel(job_id)
    if not ok:
        return JSONResponse({"status": "not_cancellable"}, status_code=409)
    return {"status": "cancelling"}


@router.post("/{job_id}/retry")
def retry_job_route(job_id: int, request: Request):
    existing = job_service.get_job(job_id)
    if existing:
        guard = _require_admin_for(existing["job_type"], request)
        if guard:
            return guard

    new_job = job_service.retry_job(job_id)
    if new_job is None:
        return JSONResponse({"error": "job is not retryable"}, status_code=409)

    config = job_runner.get_runner(new_job["job_type"])
    if config is None:
        return JSONResponse({"error": f"unknown job_type {new_job['job_type']!r}"}, status_code=404)

    threading.Thread(target=config.run, args=(new_job["id"], new_job["payload"] or {}), daemon=True).start()
    return JSONResponse({"jobId": new_job["id"], "status": new_job["status"]}, status_code=202)


@router.delete("/{job_id}")
def delete_job_route(job_id: int):
    ok = job_service.delete_job(job_id)
    if not ok:
        return JSONResponse({"error": "not found"}, status_code=404)
    return {"status": "deleted"}


@router.post("/bulk")
def bulk_action(request: Request, body: dict = Body(default={})):
    body = body or {}
    action = body.get("action")
    ids = body.get("ids") or []
    if action == "delete":
        count = job_service.bulk_delete(ids)
        return {"status": "deleted", "count": count}
    if action == "retry":
        for jid in ids:
            job = job_service.get_job(jid)
            if job:
                guard = _require_admin_for(job["job_type"], request)
                if guard:
                    return guard
        new_jobs = job_service.bulk_retry(ids)
        for job in new_jobs:
            config = job_runner.get_runner(job["job_type"])
            if config:
                threading.Thread(target=config.run, args=(job["id"], job["payload"] or {}), daemon=True).start()
        return {"status": "retried", "jobs": new_jobs}
    return JSONResponse({"error": f"unknown bulk action {action!r}"}, status_code=400)
