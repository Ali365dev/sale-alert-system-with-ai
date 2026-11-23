"""Push notification admin endpoints — Firebase config, device counts and
send-triggering. Device registration (called by the mobile app) lives on
app_server: app_server/routers/devices.py."""
import threading

from fastapi import APIRouter, Body, Depends
from fastapi.responses import JSONResponse

from core.security import require_admin
from database.db import get_session
from database.models import DeviceToken
from services import job_runner, job_service
from services.push import fcm_client

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

JOB_TYPE = "send_push_notification"


def _actor() -> str:
    return "admin"


# ── Admin ────────────────────────────────────────────────────────────────────

@router.get("/devices/count", dependencies=[Depends(require_admin)])
def device_count():
    with get_session() as session:
        active = session.query(DeviceToken).filter(DeviceToken.is_active.is_(True)).all()
        by_platform = {"ios": 0, "android": 0}
        for row in active:
            key = (row.platform or "").lower()
            if key in by_platform:
                by_platform[key] += 1
    return {"count": len(active), "by_platform": by_platform}


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
    image = (body.get("image") or "").strip() or None
    if not title or not message_body:
        return JSONResponse({"error": "title and body are required"}, status_code=400)
    if not fcm_client.is_configured():
        return JSONResponse({"error": "Firebase isn't configured yet"}, status_code=409)

    existing = job_service.get_active_job(JOB_TYPE)
    if existing:
        return JSONResponse({"status": "already_running", "job": existing}, status_code=409)

    if image and not image.startswith("https://"):
        return JSONResponse({"error": "image must be an https URL"}, status_code=400)
    payload = {"title": title, "body": message_body, "data": data, "image": image}
    job = job_service.create_job(JOB_TYPE, payload=payload)
    config = job_runner.get_runner(JOB_TYPE)
    threading.Thread(target=config.run, args=(job["id"], payload), daemon=True).start()
    return JSONResponse({"jobId": job["id"], "status": job["status"]}, status_code=202)
