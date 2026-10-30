"""Account emails (password reset, etc.) — SMTP when configured, else Gmail API.

Uses the same Gmail OAuth token the inbox sync already has (`gmail.modify`
includes send). Prefer SMTP in production if you want a dedicated noreply
address; Gmail fallback means the connected Gmail account is the From:.
"""
from __future__ import annotations

import base64
import smtplib
from email.message import EmailMessage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from google.auth.transport.requests import AuthorizedSession

from config import (
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USE_TLS,
    SMTP_USER,
    logger,
)

_GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send"


def smtp_configured() -> bool:
    return bool(SMTP_HOST and SMTP_FROM)


def email_delivery_available() -> bool:
    """True if SMTP is set, or a Gmail OAuth token exists for API send."""
    if smtp_configured():
        return True
    try:
        from gmail.gmail_client import is_connected

        return is_connected()
    except Exception:
        return False


def send_email(*, to: str, subject: str, body: str, html_body: str | None = None) -> bool:
    """Send plain text, or multipart plain+HTML when html_body is provided."""
    if smtp_configured():
        if _send_via_smtp(to=to, subject=subject, body=body, html_body=html_body):
            return True
        logger.warning("SMTP send failed for %s — trying Gmail API fallback", to)

    if _send_via_gmail(to=to, subject=subject, body=body, html_body=html_body):
        return True

    logger.warning("No email delivery method succeeded for %s", to)
    return False


def _send_via_smtp(*, to: str, subject: str, body: str, html_body: str | None) -> bool:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to
    msg.set_content(body)
    if html_body:
        msg.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as server:
            if SMTP_USE_TLS:
                server.starttls()
            if SMTP_USER:
                server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        logger.info("Sent email via SMTP to %s", to)
        return True
    except Exception:
        logger.exception("Failed to send email via SMTP to %s", to)
        return False


def _build_mime(*, to: str, subject: str, body: str, html_body: str | None) -> MIMEMultipart | MIMEText:
    if html_body:
        msg: MIMEMultipart | MIMEText = MIMEMultipart("alternative")
        msg["to"] = to
        msg["subject"] = subject
        msg.attach(MIMEText(body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))
        return msg

    plain = MIMEText(body, "plain", "utf-8")
    plain["to"] = to
    plain["subject"] = subject
    return plain


def _send_via_gmail(*, to: str, subject: str, body: str, html_body: str | None) -> bool:
    try:
        from gmail.gmail_client import get_credentials, is_connected

        if not is_connected():
            logger.warning("Gmail not connected — cannot send email to %s", to)
            return False

        mime = _build_mime(to=to, subject=subject, body=body, html_body=html_body)
        # From is implied by the authenticated Gmail user; setting it can
        # break send if it doesn't match the account.
        raw = base64.urlsafe_b64encode(mime.as_bytes()).decode("ascii")

        session = AuthorizedSession(get_credentials())
        resp = session.post(_GMAIL_SEND_URL, json={"raw": raw}, timeout=30)
        if resp.status_code >= 400:
            logger.error(
                "Gmail API send failed for %s: %s %s",
                to,
                resp.status_code,
                (resp.text or "")[:300],
            )
            return False
        logger.info("Sent email via Gmail API to %s", to)
        return True
    except Exception:
        logger.exception("Failed to send email via Gmail API to %s", to)
        return False
