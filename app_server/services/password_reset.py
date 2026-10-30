"""Forgot-password OTP issue + verify for email/password accounts."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session
from werkzeug.security import check_password_hash, generate_password_hash

from config import PASSWORD_RESET_CODE_TTL_MINUTES, PASSWORD_RESET_DEV_ECHO, logger
from database.models import PasswordResetCode, User
from services.email_templates import google_only_account_email, password_reset_email
from services.transactional_email import email_delivery_available, send_email

_GENERIC_OK = (
    "If an account exists for that email, we've sent a reset code. "
    "Check your inbox (and spam folder)."
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def request_password_reset(session: Session, email: str) -> dict:
    """Always returns a generic success payload (no email enumeration).

    When the account has a password, issues a fresh OTP, emails it (if SMTP
    is configured), and optionally echoes `dev_code` for local testing.
    """
    email = (email or "").strip().lower()
    payload: dict = {"ok": True, "message": _GENERIC_OK}

    user = session.query(User).filter(User.email == email).first()
    if user is None or not user.password_hash:
        # Google-only / unknown — same client message; optional nudge email
        # for Google-only so the user isn't stuck waiting for a code.
        if user is not None and not user.password_hash and email_delivery_available():
            content = google_only_account_email()
            send_email(
                to=email,
                subject=content.subject,
                body=content.text,
                html_body=content.html,
            )
        return payload

    code = _generate_code()
    # Invalidate prior unused codes for this email.
    session.query(PasswordResetCode).filter(
        PasswordResetCode.email == email,
        PasswordResetCode.used_at.is_(None),
    ).update(
        {PasswordResetCode.used_at: _utcnow()},
        synchronize_session=False,
    )

    row = PasswordResetCode(
        email=email,
        code_hash=generate_password_hash(code),
        expires_at=_utcnow() + timedelta(minutes=PASSWORD_RESET_CODE_TTL_MINUTES),
    )
    session.add(row)
    session.flush()

    content = password_reset_email(code=code, ttl_minutes=PASSWORD_RESET_CODE_TTL_MINUTES)
    sent = send_email(
        to=email,
        subject=content.subject,
        body=content.text,
        html_body=content.html,
    )
    if not sent:
        logger.warning(
            "Password reset code for %s was not emailed (SMTP/Gmail send unavailable)",
            email,
        )
    else:
        payload["email_sent"] = True
    if PASSWORD_RESET_DEV_ECHO:
        # Local/testing only — never enable in production.
        payload["dev_code"] = code
        logger.info("Password reset dev_code for %s: %s", email, code)

    return payload


def reset_password_with_code(
    session: Session,
    *,
    email: str,
    code: str,
    new_password: str,
) -> tuple[bool, str]:
    """Verify OTP and set a new password hash. Returns (ok, error_or_ok_message)."""
    from services import user_auth

    email = (email or "").strip().lower()
    code = (code or "").strip()
    if not email or not code:
        return False, "Enter the email and reset code from your inbox."
    if len(new_password or "") < 8:
        return False, "Password must be at least 8 characters."

    user = session.query(User).filter(User.email == email).first()
    if user is None:
        return False, "Invalid or expired reset code."

    now = _utcnow()
    candidates = (
        session.query(PasswordResetCode)
        .filter(
            PasswordResetCode.email == email,
            PasswordResetCode.used_at.is_(None),
            PasswordResetCode.expires_at >= now,
        )
        .order_by(PasswordResetCode.created_at.desc())
        .limit(5)
        .all()
    )
    match = next((row for row in candidates if check_password_hash(row.code_hash, code)), None)
    if match is None:
        return False, "Invalid or expired reset code."

    match.used_at = now
    user.password_hash = user_auth.hash_password(new_password)
    session.flush()
    return True, "Password updated. You can sign in with your new password."
