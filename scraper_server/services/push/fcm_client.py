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
from __future__ import annotations

import json
import socket
import time
from typing import Any

from services import settings_service

_SETTING_KEY = "fcm_service_account_json"
_app = None
_IPV4_PATCHED = False

# Transient network failures seen on macOS/local and under port pressure
# (e.g. after many Playwright scrapes): OSError 49 "Can't assign requested
# address", Connection aborted, etc.
_RETRYABLE_MARKERS = (
    "can't assign requested address",
    "connection aborted",
    "connection reset",
    "temporarily unavailable",
    "timed out",
    "timeout",
    "name or service not known",
    "nodename nor servname",
    "network is unreachable",
    "remote service calls",
)


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
    if _app is not None:
        try:
            import firebase_admin
            firebase_admin.delete_app(_app)
        except Exception:
            pass
    _app = None


def _prefer_ipv4() -> None:
    """Prefer IPv4 when resolving Google APIs.

    On some macOS networks, AAAA (IPv6) resolves but has no usable route;
    the client then fails with OSError(49, "Can't assign requested address").
    Preferring AF_INET avoids that path without disabling IPv6 system-wide.
    """
    global _IPV4_PATCHED
    if _IPV4_PATCHED:
        return
    _IPV4_PATCHED = True
    _orig = socket.getaddrinfo

    def _patched(*args, **kwargs):
        results = _orig(*args, **kwargs)
        ipv4 = [r for r in results if r[0] == socket.AF_INET]
        if ipv4:
            return ipv4 + [r for r in results if r[0] != socket.AF_INET]
        return results

    socket.getaddrinfo = _patched  # type: ignore[assignment]


def _get_app():
    global _app
    _prefer_ipv4()
    if _app is not None:
        return _app

    encrypted = settings_service.get_setting(_SETTING_KEY)
    if not encrypted:
        raise RuntimeError("Firebase isn't configured yet — paste a service-account JSON in Notification Management.")

    import firebase_admin
    from firebase_admin import credentials

    raw_json = settings_service.decrypt_key(encrypted)
    cred = credentials.Certificate(json.loads(raw_json))
    try:
        _app = firebase_admin.get_app(name="push-notifications")
    except ValueError:
        _app = firebase_admin.initialize_app(cred, name="push-notifications")
    return _app


def _is_retryable(exc: BaseException) -> bool:
    text = str(exc).lower()
    if any(marker in text for marker in _RETRYABLE_MARKERS):
        return True
    if isinstance(exc, (ConnectionError, TimeoutError, OSError)):
        return True
    cause = getattr(exc, "__cause__", None) or getattr(exc, "__context__", None)
    if cause is not None and cause is not exc:
        return _is_retryable(cause)
    return False


def _friendly_network_error(exc: BaseException) -> RuntimeError:
    return RuntimeError(
        "Could not reach Firebase Cloud Messaging "
        f"({type(exc).__name__}: {exc}). "
        "Usually a local network issue: VPN/firewall, exhausted sockets after "
        "heavy scraping, or broken IPv6. Check internet, disable VPN briefly, "
        "restart the API server, then retry the notification."
    )


def send_multicast(
    tokens: list[str],
    title: str,
    body: str,
    data: dict | None = None,
    *,
    max_attempts: int = 4,
) -> Any:
    """Sends one notification to up to 500 tokens in a single FCM call.
    Returns the SDK's BatchResponse (has .responses, .success_count,
    .failure_count) — callers inspect .responses to find which tokens are
    dead (unregistered/invalid) and should be deactivated.

    Retries transient connection failures (OSError 49 / Connection aborted)
    with exponential backoff and recreates the Firebase app between attempts.
    """
    from firebase_admin import messaging

    if not tokens:
        return messaging.BatchResponse([])

    # Explicit APNs headers/sound so TestFlight (production APNs) surfaces a
    # banner. Top-level `notification` still carries title/body for both OS.
    apns = messaging.APNSConfig(
        headers={"apns-priority": "10", "apns-push-type": "alert"},
        payload=messaging.APNSPayload(
            aps=messaging.Aps(sound="default", badge=1),
        ),
    )
    message = messaging.MulticastMessage(
        notification=messaging.Notification(title=title, body=body),
        data={k: str(v) for k, v in (data or {}).items()},
        tokens=tokens,
        apns=apns,
        android=messaging.AndroidConfig(priority="high"),
    )

    last_exc: BaseException | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            app = _get_app()
            return messaging.send_each_for_multicast(message, app=app)
        except Exception as exc:
            last_exc = exc
            if not _is_retryable(exc) or attempt >= max_attempts:
                break
            # Drop the cached app so the next try opens a fresh HTTP session.
            reset()
            time.sleep(min(2 ** (attempt - 1), 8))

    assert last_exc is not None
    raise _friendly_network_error(last_exc) from last_exc
