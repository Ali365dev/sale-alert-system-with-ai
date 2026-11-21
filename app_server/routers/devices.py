"""Push-token registration — public, called by the mobile app on launch,
on every foreground and on FCM token refresh. Lives on app_server because
the app only talks to app_server (app/src/services/config.js); scraper_server
reads these rows when it sends pushes."""
from datetime import datetime, timezone

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from database.db import get_session
from database.models import DeviceToken

router = APIRouter(prefix="/api/notifications", tags=["devices"])


@router.post("/devices/register")
def register_device(body: dict = Body(default={})):
    body = body or {}
    token = (body.get("token") or "").strip()
    platform = (body.get("platform") or "").strip().lower()
    device_id = (body.get("device_id") or "").strip() or None
    if not token or platform not in ("ios", "android"):
        return JSONResponse({"error": "token and platform ('ios' or 'android') are required"}, status_code=400)

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    with get_session() as session:
        row = session.query(DeviceToken).filter(DeviceToken.token == token).first()
        if row:
            row.platform = platform
            row.is_active = True
            row.last_seen_at = now  # set explicitly: onupdate only fires when another column changed
            if device_id:
                row.device_id = device_id
        else:
            session.add(DeviceToken(token=token, platform=platform, device_id=device_id, last_seen_at=now))

        # One install → one active token. When the same device_id registers a
        # refreshed FCM token, deactivate older rows so personalized notify
        # (keyed by device_id) does not skip a live user stuck on a dead token.
        if device_id:
            session.query(DeviceToken).filter(
                DeviceToken.device_id == device_id,
                DeviceToken.token != token,
                DeviceToken.is_active.is_(True),
            ).update({"is_active": False}, synchronize_session=False)

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
