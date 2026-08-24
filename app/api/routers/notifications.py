"""Push notification endpoints — device registration (public, called by the
app itself) plus Firebase config and send-triggering (admin-only). Ported
from api/notifications.py — logic and response shape unchanged; the Flask
@settings_auth.require_admin decorator becomes Depends(require_admin) (see
app/core/security.py)."""
import threading

from fastapi import APIRouter, Body, Depends
from fastapi.responses import JSONResponse

from app.core.security import require_admin
from database.db import get_session
from database.models import DeviceToken
from services import job_runner, job_service
from services.push import fcm_client

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

JOB_TYPE = "send_push_notification"


def _actor() -> str:
    return "admin"


# ── Device registration (public — called by the app) ──────────────────────────

@router.post("/devices/register")
def register_device(body: dict = Body(default={})):
    body = body or {}
    token = (body.get("token") or "").strip()
    platform = (body.get("platform") or "").strip().lower()
    if not token or platform not in ("ios", "android"):
        return JSONResponse({"error": "token and platform ('ios' or 'android') are required"}, status_code=400)

    with get_session() as session:
        row = session.query(DeviceToken).filter(DeviceToken.token == token).first()
        if row:
            row.platform = platform
            row.is_active = True
        else:
            session.add(DeviceToken(token=token, platform=platform))

    return {"status": "registered"}


@router.post("/devices/unregister")
def unregister_device(body: dict = Body(default={})):
    body = body or {}
    token = (body.get("token") or "").strip()
    if not token:
        return JSONResponse({"error": "token is required"}, status_code=400)

    with get_session() as session:
        session.query(DeviceToken).filter(DeviceToken.token == token).update({"is_active": False})

    return {"status": "unregistered"}


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/devices/count", dependencies=[Depends(require_admin)])
def device_count():
    with get_session() as session:
        count = session.query(DeviceToken).filter(DeviceToken.is_active.is_(True)).count()
    return {"count": count}


@router.get("/fcm-status", dependencies=[Depends(require_admin)])
def fcm_status():
    return {"configured": fcm_client.is_configured()}


@router.post("/fcm-config", dependencies=[Depends(require_admin)])
def fcm_config(body: dict = Body(default={})):
    body = body or {}
    raw_json = body.get("service_account_json") or ""
    if not raw_json:
        return JSONResponse({"error": "service_account_json is required"}, status_code=400)

    try:
        fcm_client.save_service_account(raw_json, actor=_actor())
    except ValueError as exc:
        return JSONResponse({"error": str(exc)}, status_code=400)

    return {"status": "saved"}


@router.post("/send", dependencies=[Depends(require_admin)])
def send_notification(body: dict = Body(default={})):
    body = body or {}
    title = (body.get("title") or "").strip()
    message_body = (body.get("body") or "").strip()
    data = body.get("data") or None
    if not title or not message_body:
        return JSONResponse({"error": "title and body are required"}, status_code=400)
    if not fcm_client.is_configured():
        return JSONResponse({"error": "Firebase isn't configured yet"}, status_code=409)

    existing = job_service.get_active_job(JOB_TYPE)
    if existing:
        return JSONResponse({"status": "already_running", "job": existing}, status_code=409)

    payload = {"title": title, "body": message_body, "data": data}
    job = job_service.create_job(JOB_TYPE, payload=payload)
    config = job_runner.get_runner(JOB_TYPE)
    threading.Thread(target=config.run, args=(job["id"], payload), daemon=True).start()
    return JSONResponse({"jobId": job["id"], "status": job["status"]}, status_code=202)
