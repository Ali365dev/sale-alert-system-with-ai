"""
Fetches emails from the 'sales_offers' Gmail label and persists new ones to
the database.  Already-seen messages (matched by gmail_message_id) are skipped
so the job is safe to run repeatedly.

Returns a list of dicts (id, subject, body) for downstream AI analysis.

Uses google.auth.transport.requests.AuthorizedSession (requests-based) to
avoid httplib2 TCP-level timeouts on certain networks.
"""
import base64
import html as _html
import json
import re
import threading
from datetime import datetime, timezone
from typing import Callable, Optional

from google.auth.transport.requests import AuthorizedSession

from config import GMAIL_LABEL as _GMAIL_LABEL_DEFAULT, logger
from database.db import get_session
from database.models import Email
from gmail.gmail_client import get_credentials
from services.settings_service import get_setting


def _gmail_label() -> str:
    """Read fresh from Settings on every call so a label change (Settings ->
    Email Processing) takes effect on the very next sync, no restart needed."""
    return get_setting("gmail_label", default=_GMAIL_LABEL_DEFAULT)


GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"
REQUEST_TIMEOUT = 60  # seconds


def _get_session() -> AuthorizedSession:
    """Return a requests-based authorized session, refreshing or re-authorising as needed."""
    return AuthorizedSession(get_credentials())


_IMG_SRC_RE = re.compile(r'<img[^>]+src=["\']([^"\']+)["\']', re.IGNORECASE)
_URL_RE = re.compile(r"https?://\S+", re.IGNORECASE)
_INLINE_WS_RE = re.compile(r"[ \t]+")
_BLANK_LINES_RE = re.compile(r"\n\s*\n+")
# <style>/<script> content is plain text between the tags — a naive
# tag-stripping regex leaves all the CSS rules / JS leaking into the body.
# Must run before the generic tag strip, and before <img> extraction doesn't
# care since it only looks for <img> tags specifically.
_STYLE_SCRIPT_RE = re.compile(r"<(style|script)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_COMMENT_RE = re.compile(r"<!--.*?-->", re.DOTALL)


def _extract_image_urls(html: str) -> list[str]:
    """Pull <img src="..."> URLs out of raw HTML, deduped, http(s) only."""
    seen: list[str] = []
    for url in _IMG_SRC_RE.findall(html):
        if url.startswith(("http://", "https://")) and url not in seen:
            seen.append(url)
    return seen


def _clean_text(text: str) -> str:
    """Strip any remaining URLs, decode HTML entities (&nbsp; &amp; etc.), and
    collapse the whitespace they leave behind, without flattening intentional
    paragraph breaks."""
    text = _URL_RE.sub("", text)
    text = _html.unescape(text).replace("\xa0", " ")
    text = _INLINE_WS_RE.sub(" ", text)
    text = _BLANK_LINES_RE.sub("\n", text)
    return text.strip()


def _find_part(payload: dict, mime_type_wanted: str) -> Optional[str]:
    """Recursively search a MIME tree for the first part matching mime_type_wanted,
    returning its decoded raw content (or None if no such part exists)."""
    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data", "")

    if mime_type == mime_type_wanted and body_data:
        return base64.urlsafe_b64decode(body_data + "==").decode("utf-8", errors="replace")

    for part in payload.get("parts", []):
        found = _find_part(part, mime_type_wanted)
        if found is not None:
            return found

    return None


def _decode_body(payload: dict) -> tuple[str, list[str]]:
    """Extract (plain_text, image_urls) from a Gmail message payload.

    text/html is preferred over text/plain when both exist — many ESPs put a
    generic "view this email online" stub in the plain-text alternative, which
    would otherwise get picked up instead of the real content and its images.
    plain_text has all HTML tags and URLs stripped out — image URLs are pulled
    into their own list first, so nothing but clean text reaches the `body` column.
    """
    html = _find_part(payload, "text/html")
    if html is not None:
        image_urls = _extract_image_urls(html)
        stripped = _COMMENT_RE.sub(" ", html)
        stripped = _STYLE_SCRIPT_RE.sub(" ", stripped)
        text = re.sub(r"<[^>]+>", " ", stripped)
        return _clean_text(text), image_urls

    plain = _find_part(payload, "text/plain")
    if plain is not None:
        return _clean_text(plain), []

    return "", []


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    from email.utils import parsedate_to_datetime
    try:
        dt = parsedate_to_datetime(date_str)
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    except Exception:
        return None


def get_mailbox_profile(session: AuthorizedSession) -> dict:
    """emailAddress/messagesTotal/threadsTotal for the connected account —
    covered by the gmail.modify scope already in use, no extra OAuth scope
    (and therefore no extra re-auth) needed for the Settings Google Account tab."""
    resp = session.get(f"{GMAIL_API_BASE}/profile", timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def _get_label_id(session: AuthorizedSession, label_name: str) -> Optional[str]:
    resp = session.get(f"{GMAIL_API_BASE}/labels", timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    for lbl in resp.json().get("labels", []):
        if lbl["name"].lower() == label_name.lower():
            return lbl["id"]
    logger.warning("Label '%s' not found in Gmail account.", label_name)
    return None


def list_new_message_ids(limit: Optional[int] = None) -> tuple[AuthorizedSession, list[str]]:
    """Return an authorized session plus the message IDs under GMAIL_LABEL that
    aren't already stored. Used by the concurrent email-sync job so listing
    happens once up front and fetching can then be fanned out across workers.

    limit, if given, stops listing once that many of the label's most recent
    messages have been seen — Gmail returns each page newest-first, so
    anything older than the latest `limit` is never even looked at, let alone
    fetched or processed. This is Settings -> Email Processing -> "Fetch only
    latest N emails" — distinct from max_emails_per_sync, which caps
    per-run *processing* of whatever's already been listed, not what gets
    listed from Gmail in the first place.
    """
    session = _get_session()
    label_id = _get_label_id(session, _gmail_label())
    if not label_id:
        return session, []

    all_message_ids: list[str] = []
    page_token: Optional[str] = None
    while True:
        params: dict = {"labelIds": label_id, "maxResults": 500}
        if page_token:
            params["pageToken"] = page_token
        resp = session.get(f"{GMAIL_API_BASE}/messages", params=params, timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        all_message_ids.extend(m["id"] for m in data.get("messages", []))
        if limit and len(all_message_ids) >= limit:
            all_message_ids = all_message_ids[:limit]
            break
        page_token = data.get("nextPageToken")
        if not page_token:
            break

    with get_session() as db_session:
        existing_ids = {row[0] for row in db_session.query(Email.gmail_message_id).all()}

    new_ids = [mid for mid in all_message_ids if mid not in existing_ids]
    logger.info(
        "%d new message(s) to process (of %d total under label%s).",
        len(new_ids), len(all_message_ids), f", capped to latest {limit}" if limit else "",
    )
    return session, new_ids


def fetch_single_message(session: AuthorizedSession, msg_id: str) -> dict:
    """Download and parse one Gmail message. Raises on network/HTTP failure
    (caller is expected to retry transient errors)."""
    resp = session.get(
        f"{GMAIL_API_BASE}/messages/{msg_id}",
        params={"format": "full"},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    msg = resp.json()

    headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
    body, image_urls = _decode_body(msg.get("payload", {}))
    return {
        "gmail_message_id": msg_id,
        "sender": headers.get("From", "unknown"),
        "subject": headers.get("Subject", "(no subject)"),
        "body": body[:50_000],
        "image_urls": image_urls,
        "received_date": _parse_date(headers.get("Date")),
    }


def fetch_and_store_emails(
    on_progress: Optional[Callable[[str, dict], None]] = None,
    cancel_event: Optional[threading.Event] = None,
) -> list[dict]:
    """
    Pull all messages from GMAIL_LABEL, skip already-stored ones, persist
    new Email rows, and return a list of dicts with keys:
        id, gmail_message_id, subject, body

    `on_progress(event, data)` is called for "listing", "found", "message",
    "cancelled" — used to surface live status to API callers. `cancel_event`,
    when set, stops the per-message loop after the current message finishes.
    """
    def emit(event: str, **data):
        if on_progress:
            on_progress(event, data)

    emit("listing")
    session = _get_session()
    label_name = _gmail_label()
    label_id = _get_label_id(session, label_name)
    if not label_id:
        return []

    # Paginated listing of all message IDs under the label
    all_message_ids: list[str] = []
    page_token: Optional[str] = None
    while True:
        params: dict = {"labelIds": label_id, "maxResults": 500}
        if page_token:
            params["pageToken"] = page_token
        try:
            resp = session.get(f"{GMAIL_API_BASE}/messages", params=params, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
        except Exception as exc:
            logger.error("Error listing messages: %s", exc)
            break
        data = resp.json()
        all_message_ids.extend(m["id"] for m in data.get("messages", []))
        page_token = data.get("nextPageToken")
        if not page_token:
            break

    logger.info("Found %d message(s) under label '%s'.", len(all_message_ids), label_name)

    # Load existing IDs from DB
    with get_session() as db_session:
        existing_ids = {row[0] for row in db_session.query(Email.gmail_message_id).all()}

    new_ids = [mid for mid in all_message_ids if mid not in existing_ids]
    logger.info("%d new message(s) to process.", len(new_ids))
    emit("found", total=len(new_ids))

    saved: list[dict] = []
    for i, msg_id in enumerate(new_ids):
        if cancel_event is not None and cancel_event.is_set():
            logger.info("Fetch cancelled by user after %d/%d message(s).", i, len(new_ids))
            emit("cancelled", done=i, total=len(new_ids))
            break

        try:
            resp = session.get(
                f"{GMAIL_API_BASE}/messages/{msg_id}",
                params={"format": "full"},
                timeout=REQUEST_TIMEOUT,
            )
            resp.raise_for_status()
            msg = resp.json()
        except Exception as exc:
            logger.error("Could not fetch message %s: %s", msg_id, exc)
            emit("message", done=i + 1, total=len(new_ids), subject=None, error=str(exc))
            continue

        headers = {
            h["name"]: h["value"]
            for h in msg.get("payload", {}).get("headers", [])
        }
        sender = headers.get("From", "unknown")
        subject = headers.get("Subject", "(no subject)")
        body, image_urls = _decode_body(msg.get("payload", {}))

        email_row = Email(
            gmail_message_id=msg_id,
            sender=sender,
            subject=subject,
            body=body[:50_000],
            image_urls=json.dumps(image_urls) if image_urls else None,
            received_date=_parse_date(headers.get("Date")),
            processed_at=datetime.utcnow(),
        )

        with get_session() as db_session:
            db_session.add(email_row)
            db_session.flush()
            new_id = email_row.id

        saved.append({"id": new_id, "gmail_message_id": msg_id, "subject": subject, "body": body})
        logger.info("Stored email id=%s subject=%r", new_id, subject[:60])
        emit("message", done=i + 1, total=len(new_ids), subject=subject)

    return saved
