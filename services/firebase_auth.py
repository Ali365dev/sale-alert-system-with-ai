"""Verifies Firebase ID tokens for "Continue with Google" on the mobile app.

Reuses the exact same Firebase Admin app + service-account credential
already configured for push notifications (see services/push/fcm_client.py,
pasted into the dashboard's Notification Management page) — there's only
ever one Firebase project behind this app, so there's nothing new to
configure server-side to support this."""
from services.push import fcm_client


def is_configured() -> bool:
    return fcm_client.is_configured()


def verify_firebase_token(id_token: str) -> dict | None:
    """Returns the verified token payload (uid, email, name, ...) or None if
    the token is missing, invalid, expired, or Firebase isn't configured."""
    if not id_token:
        return None

    from firebase_admin import auth as firebase_auth_sdk

    try:
        app = fcm_client._get_app()
        return firebase_auth_sdk.verify_id_token(id_token, app=app)
    except Exception:
        return None
