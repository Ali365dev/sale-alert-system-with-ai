"""Mobile-app end-user auth (email + password) — a separate concern from
services/settings_auth.py's single-admin-password gate for the web
dashboard. Framework-agnostic pieces only (hashing, token creation/
verification); the "reject an unauthenticated request" FastAPI dependency
lives in app/core/user_security.py.

Tokens reuse the same signed/timed-token approach as settings_auth.py
(itsdangerous), with a distinct salt so a user token and an admin session
token are never interchangeable even though they share one underlying
secret — no new required config beyond what settings auth already needs."""
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from werkzeug.security import check_password_hash, generate_password_hash

TOKEN_MAX_AGE = 30 * 24 * 3600  # 30 days — mobile sessions persist much longer than an admin web session


def _serializer() -> URLSafeTimedSerializer:
    from config import SETTINGS_SESSION_SECRET
    if not SETTINGS_SESSION_SECRET:
        raise RuntimeError(
            "SETTINGS_SESSION_SECRET (or SETTINGS_ENCRYPTION_KEY) is not set — required for user auth tokens."
        )
    return URLSafeTimedSerializer(SETTINGS_SESSION_SECRET, salt="user-auth")


def hash_password(raw_password: str) -> str:
    return generate_password_hash(raw_password)


def check_password(password_hash: str, raw_password: str) -> bool:
    return check_password_hash(password_hash, raw_password)


def create_user_token(user_id: int) -> str:
    return _serializer().dumps({"user_id": user_id})


def verify_user_token(token: str | None) -> int | None:
    """Returns the user id the token was issued for, or None if missing/invalid/expired."""
    if not token:
        return None
    try:
        payload = _serializer().loads(token, max_age=TOKEN_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
    return payload.get("user_id")
