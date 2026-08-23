"""Push notification endpoints — device registration (public, called by the
app itself) plus Firebase config and send-triggering (admin-only, gated by
services.settings_auth.require_admin like the rest of the Settings module).

/send is a deliberate, narrow exception to api/jobs.py's generic (and
unauthenticated) /<job_type>/start route: starting a push send is a
user-facing action that must not be triggerable by an arbitrary caller, so
it gets its own admin-gated dispatch here rather than adding per-type auth
to the shared job-start plumbing every other job type uses. Progress/history
after that still go through the existing, already-public /api/jobs/* routes
— nothing there changes.
"""
import threading

from flask import Blueprint, jsonify, request

from database.db import get_session
from database.models import DeviceToken
from services import job_runner, job_service, settings_auth
from services.push import fcm_client

bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")

JOB_TYPE = "send_push_notification"


def _actor() -> str:
    return "admin"


# ── Device registration (public — called by the app) ──────────────────────────

@bp.post("/devices/register")
def register_device():
    body = request.get_json(silent=True) or {}
    token = (body.get("token") or "").strip()
    platform = (body.get("platform") or "").strip().lower()
    if not token or platform not in ("ios", "android"):
        return jsonify({"error": "token and platform ('ios' or 'android') are required"}), 400

    with get_session() as session:
        row = session.query(DeviceToken).filter(DeviceToken.token == token).first()
        if row:
            row.platform = platform
            row.is_active = True
        else:
            session.add(DeviceToken(token=token, platform=platform))

    return jsonify({"status": "registered"})


@bp.post("/devices/unregister")
def unregister_device():
    body = request.get_json(silent=True) or {}
    token = (body.get("token") or "").strip()
    if not token:
        return jsonify({"error": "token is required"}), 400

    with get_session() as session:
        session.query(DeviceToken).filter(DeviceToken.token == token).update({"is_active": False})

    return jsonify({"status": "unregistered"})


# ── Admin ────────────────────────────────────────────────────────────────────

@bp.get("/devices/count")
@settings_auth.require_admin
def device_count():
    with get_session() as session:
        count = session.query(DeviceToken).filter(DeviceToken.is_active.is_(True)).count()
    return jsonify({"count": count})


@bp.get("/fcm-status")
@settings_auth.require_admin
def fcm_status():
    return jsonify({"configured": fcm_client.is_configured()})


@bp.post("/fcm-config")
@settings_auth.require_admin
def fcm_config():
    body = request.get_json(silent=True) or {}
    raw_json = body.get("service_account_json") or ""
    if not raw_json:
        return jsonify({"error": "service_account_json is required"}), 400

    try:
        fcm_client.save_service_account(raw_json, actor=_actor())
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"status": "saved"})


@bp.post("/send")
@settings_auth.require_admin
def send_notification():
    body = request.get_json(silent=True) or {}
    title = (body.get("title") or "").strip()
    message_body = (body.get("body") or "").strip()
    data = body.get("data") or None
    if not title or not message_body:
        return jsonify({"error": "title and body are required"}), 400
    if not fcm_client.is_configured():
        return jsonify({"error": "Firebase isn't configured yet"}), 409

    existing = job_service.get_active_job(JOB_TYPE)
    if existing:
        return jsonify({"status": "already_running", "job": existing}), 409

    payload = {"title": title, "body": message_body, "data": data}
    job = job_service.create_job(JOB_TYPE, payload=payload)
    config = job_runner.get_runner(JOB_TYPE)
    threading.Thread(target=config.run, args=(job["id"], payload), daemon=True).start()
    return jsonify({"jobId": job["id"], "status": job["status"]}), 202
