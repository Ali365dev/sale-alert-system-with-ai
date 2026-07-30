"""Single-admin password gate for /api/settings/* — not a general user
system, just enough to keep API keys/prompts from being wide open like the
rest of this app's currently-unauthenticated API.

First call to /login with no admin password set yet bootstraps one (that
password becomes "the" admin password) rather than requiring a separate
signup step — reasonable for a single-operator tool.
"""
from functools import wraps

from flask import jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

from services import settings_service

SESSION_COOKIE = "settings_session"
SESSION_MAX_AGE = 7 * 24 * 3600  # 7 days


def _serializer() -> URLSafeTimedSerializer:
    from config import SETTINGS_SESSION_SECRET
    if not SETTINGS_SESSION_SECRET:
        raise RuntimeError(
            "SETTINGS_SESSION_SECRET (or SETTINGS_ENCRYPTION_KEY) is not set — required for Settings login."
        )
    return URLSafeTimedSerializer(SETTINGS_SESSION_SECRET, salt="settings-session")


def has_admin_password() -> bool:
    return settings_service.get_setting("admin_password_hash") is not None


def set_admin_password(raw_password: str, actor: str = "admin") -> None:
    settings_service.set_setting(
        "admin_password_hash", generate_password_hash(raw_password), category="auth", actor=actor,
    )


def check_admin_password(raw_password: str) -> bool:
    stored_hash = settings_service.get_setting("admin_password_hash")
    if not stored_hash:
        return False
    return check_password_hash(stored_hash, raw_password)


def create_session_token() -> str:
    return _serializer().dumps({"admin": True})


def verify_session_token(token: str | None) -> bool:
    if not token:
        return False
    try:
        _serializer().loads(token, max_age=SESSION_MAX_AGE)
        return True
    except (BadSignature, SignatureExpired):
        return False


def require_admin(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not verify_session_token(request.cookies.get(SESSION_COOKIE)):
            return jsonify({"error": "not authenticated"}), 401
        return fn(*args, **kwargs)
    return wrapper
