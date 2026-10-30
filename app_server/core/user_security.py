"""FastAPI dependency for mobile-app end-user auth (Bearer token) — a
separate concern from app/core/security.py's admin session-cookie gate.
Mirrors that file's pattern: a plain exception (not HTTPException) so the
error body stays {"error": ...} like every other response in this app, via
app/main.py's exception_handler registration."""
from fastapi import Header

from database.db import get_session
from database.models import User
from services import user_auth


class UserAuthError(Exception):
    pass


def _user_id_from_header(authorization: str | None) -> int | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization[len("Bearer "):].strip()
    return user_auth.verify_user_token(token)


def get_current_user(authorization: str | None = Header(default=None)) -> User:
    """Raises UserAuthError (-> 401) when the token is missing, invalid,
    expired, or no longer matches a real account."""
    user_id = _user_id_from_header(authorization)
    if user_id is None:
        raise UserAuthError()

    with get_session() as session:
        user = session.query(User).filter(User.id == user_id).first()
        if user is None:
            raise UserAuthError()
        session.expunge(user)
        return user


def get_optional_user(authorization: str | None = Header(default=None)) -> User | None:
    """Same lookup, but returns None instead of raising — for endpoints
    usable by both guests and signed-in users (e.g. /api/preferences)."""
    user_id = _user_id_from_header(authorization)
    if user_id is None:
        return None

    with get_session() as session:
        user = session.query(User).filter(User.id == user_id).first()
        if user is None:
            return None
        session.expunge(user)
        return user
