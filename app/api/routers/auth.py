"""Mobile-app end-user auth — signup/login/logout + /me. Guest (device-scoped)
mode keeps working independently (see database/models.py::UserProfile);
signing up or logging in on a device links that device's existing
UserProfile row to the account rather than starting a separate preferences
record, so followed brands/favorite categories carry over from guest use."""
import json
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.user_security import get_current_user
from database.db import get_session
from database.models import User, UserProfile
from services import firebase_auth, user_auth

router = APIRouter(prefix="/api/auth", tags=["auth"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_MIN_PASSWORD_LENGTH = 8


def _user_to_dict(u: User) -> dict:
    return {"id": u.id, "email": u.email, "name": u.name}


def _profile_fields(p: UserProfile | None) -> dict:
    if p is None:
        return {"brands": [], "categories": []}
    return {
        "brands": json.loads(p.brands) if p.brands else [],
        "categories": json.loads(p.categories) if p.categories else [],
    }


def _link_device_and_get_profile(session: Session, user: User, device_id: str | None) -> UserProfile | None:
    """Reconciles a device's local (guest) preferences with the account's own
    saved preferences on signup/login:
      - No account profile exists yet (first-ever link, typically signup):
        adopt this device's current guest prefs as-is.
      - An account profile already exists on a *different* row (e.g.
        logging in on a new device): the account's saved prefs are
        authoritative — this device's row is linked and brought in line
        with them, rather than the account's real data being lost to
        whatever this new device's guest state happened to be.
      - No device_id given: just return whatever the account already has.
    """
    account_profile = (
        session.query(UserProfile)
        .filter(UserProfile.user_id == str(user.id))
        .order_by(UserProfile.updated_at.desc())
        .first()
    )

    device_id = (device_id or "").strip()
    if not device_id:
        return account_profile

    device_profile = session.query(UserProfile).filter(UserProfile.device_id == device_id).first()
    if device_profile is None:
        device_profile = UserProfile(device_id=device_id, brands=json.dumps([]), categories=json.dumps([]))
        session.add(device_profile)
        session.flush()

    if account_profile is None:
        device_profile.user_id = str(user.id)
        session.flush()
        return device_profile

    if account_profile.id != device_profile.id:
        device_profile.user_id = str(user.id)
        device_profile.brands = account_profile.brands
        device_profile.categories = account_profile.categories
        session.flush()
        return device_profile

    return account_profile


@router.post("/signup")
def signup(body: dict = Body(...)):
    body = body or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    name = (body.get("name") or "").strip() or None
    device_id = body.get("device_id")

    if not _EMAIL_RE.match(email):
        return JSONResponse({"error": "Enter a valid email address."}, status_code=400)
    if len(password) < _MIN_PASSWORD_LENGTH:
        return JSONResponse({"error": f"Password must be at least {_MIN_PASSWORD_LENGTH} characters."}, status_code=400)

    with get_session() as session:
        if session.query(User).filter(User.email == email).first() is not None:
            return JSONResponse({"error": "An account with this email already exists."}, status_code=409)

        user = User(
            email=email,
            password_hash=user_auth.hash_password(password),
            name=name,
            last_login_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        session.add(user)
        session.flush()

        profile = _link_device_and_get_profile(session, user, device_id)
        token = user_auth.create_user_token(user.id)
        return JSONResponse(
            {"token": token, "user": _user_to_dict(user), **_profile_fields(profile)},
            status_code=201,
        )


@router.post("/login")
def login(body: dict = Body(...)):
    body = body or {}
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    device_id = body.get("device_id")

    with get_session() as session:
        user = session.query(User).filter(User.email == email).first()
        # user.password_hash is None for a Google-only account (never set
        # one) — check_password would error on a None hash, not just fail,
        # so that has to short-circuit before it's even called.
        if user is None or not user.password_hash or not user_auth.check_password(user.password_hash, password):
            return JSONResponse({"error": "Incorrect email or password."}, status_code=401)

        user.last_login_at = datetime.now(timezone.utc).replace(tzinfo=None)
        profile = _link_device_and_get_profile(session, user, device_id)
        token = user_auth.create_user_token(user.id)
        return {"token": token, "user": _user_to_dict(user), **_profile_fields(profile)}


@router.post("/google")
def google_login(body: dict = Body(...)):
    """Exchanges a Firebase ID token (the mobile app signs in with Google via
    Firebase Auth, then sends its resulting Firebase ID token here — never a
    raw Google token) for this app's own session token. Finds the account by
    firebase_uid first (repeat sign-ins), falling back to matching by email
    so a user who already signed up with a password and later taps
    "Continue with Google" under the same address gets linked onto their
    existing account instead of a duplicate — they can then use either
    method going forward."""
    body = body or {}
    id_token = body.get("id_token") or ""
    device_id = body.get("device_id")

    if not firebase_auth.is_configured():
        return JSONResponse({"error": "Google sign-in isn't set up on the server yet."}, status_code=503)

    payload = firebase_auth.verify_firebase_token(id_token)
    if payload is None:
        return JSONResponse({"error": "Invalid or expired Google sign-in token."}, status_code=401)

    email = (payload.get("email") or "").strip().lower()
    if not email:
        return JSONResponse({"error": "That Google account has no email address."}, status_code=400)
    firebase_uid = payload.get("uid") or payload.get("user_id")
    name = payload.get("name")

    with get_session() as session:
        user = session.query(User).filter(User.firebase_uid == firebase_uid).first() if firebase_uid else None
        if user is None:
            user = session.query(User).filter(User.email == email).first()

        if user is None:
            user = User(
                email=email,
                password_hash=None,
                name=name,
                firebase_uid=firebase_uid,
                last_login_at=datetime.now(timezone.utc).replace(tzinfo=None),
            )
            session.add(user)
            session.flush()
        else:
            user.last_login_at = datetime.now(timezone.utc).replace(tzinfo=None)
            if firebase_uid and not user.firebase_uid:
                user.firebase_uid = firebase_uid
            if name and not user.name:
                user.name = name

        profile = _link_device_and_get_profile(session, user, device_id)
        token = user_auth.create_user_token(user.id)
        return {"token": token, "user": _user_to_dict(user), **_profile_fields(profile)}


@router.post("/logout")
def logout():
    # Tokens are stateless (signed + time-limited, verified client-side by
    # the mobile app deleting it) — nothing to invalidate server-side.
    return {"status": "ok"}


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return _user_to_dict(user)
