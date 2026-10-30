"""FastAPI-native admin-auth dependency, replacing services/settings_auth.py's
Flask @wraps decorator for the /api/settings/* and /api/notifications/*
admin-only routes. Reuses every framework-agnostic piece of
settings_auth.py as-is (verify_session_token, SESSION_COOKIE, password
hashing, session token creation) — only the "how do I reject an
unauthenticated request" mechanism changes, from a decorator to a
dependency.

AdminAuthError is a plain exception rather than fastapi.HTTPException so the
error response body stays {"error": "not authenticated"} (matching every
other error response in this app, and what the dashboard's apiClient
interceptor reads) instead of HTTPException's default {"detail": ...} shape
— see app/main.py's exception_handler registration."""
from fastapi import Request

from services import settings_auth


class AdminAuthError(Exception):
    pass


def require_admin(request: Request) -> None:
    if not settings_auth.verify_session_token(request.cookies.get(settings_auth.SESSION_COOKIE)):
        raise AdminAuthError()
