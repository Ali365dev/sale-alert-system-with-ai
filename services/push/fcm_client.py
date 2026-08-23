"""Thin wrapper around the Firebase Admin SDK for sending push notifications.

The service-account credential is never kept in an env var or on disk — it's
pasted into the dashboard's Notification Management page once, then stored
encrypted at rest as a Setting (key "fcm_service_account_json", category
"providers"), the same way the Gmail OAuth token is stored. See
services/settings_service.py's encrypt_key/decrypt_key.

The firebase_admin App is initialized lazily and cached at module level —
init_app() is expensive and only needs to happen once per process, but the
credential can change at runtime via the dashboard, so a config save should
call reset() to force the next send to pick up the new credential.
"""
import json

from services import settings_service

_SETTING_KEY = "fcm_service_account_json"
_app = None


def is_configured() -> bool:
    return settings_service.get_setting(_SETTING_KEY) is not None


def save_service_account(raw_json: str, actor: str | None = None) -> None:
    """Validates the pasted JSON looks like a Firebase service-account file,
    then encrypts and stores it. Raises ValueError on malformed input."""
    try:
        parsed = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Not valid JSON: {exc}") from exc

    if parsed.get("type") != "service_account" or "project_id" not in parsed:
        raise ValueError("Doesn't look like a Firebase service-account JSON file (missing type/project_id).")

    encrypted = settings_service.encrypt_key(raw_json)
    settings_service.set_setting(_SETTING_KEY, encrypted, category="providers", actor=actor)
    reset()


def reset() -> None:
    """Drops the cached Firebase app so the next send re-reads the credential."""
    global _app
    _app = None


def _get_app():
    global _app
    if _app is not None:
        return _app

    encrypted = settings_service.get_setting(_SETTING_KEY)
    if not encrypted:
        raise RuntimeError("Firebase isn't configured yet — paste a service-account JSON in Notification Management.")

    import firebase_admin
    from firebase_admin import credentials

    raw_json = settings_service.decrypt_key(encrypted)
    cred = credentials.Certificate(json.loads(raw_json))
    _app = firebase_admin.initialize_app(cred, name="push-notifications")
    return _app


def send_multicast(tokens: list[str], title: str, body: str, data: dict | None = None):
    """Sends one notification to up to 500 tokens in a single FCM call.
    Returns the SDK's BatchResponse (has .responses, .success_count,
    .failure_count) — callers inspect .responses to find which tokens are
    dead (unregistered/invalid) and should be deactivated."""
    from firebase_admin import messaging

    app = _get_app()
    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=title, body=body),
        data={k: str(v) for k, v in (data or {}).items()},
        tokens=tokens,
    )
    return messaging.send_each_for_multicast(message, app=app)
