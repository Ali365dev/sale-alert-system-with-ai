"""Gmail label management + inbox scanning used by the brand-sender
auto-labeling job (services/jobs/label_brand_emails.py).

Requires the gmail.modify OAuth scope (config.GMAIL_SCOPES) — read-only
tokens can list/read messages but cannot create or apply labels.
"""
from email.utils import parseaddr

from google.auth.transport.requests import AuthorizedSession

from config import logger
from gmail.gmail_service import GMAIL_API_BASE, REQUEST_TIMEOUT


def get_or_create_label_id(session: AuthorizedSession, label_name: str) -> str:
    """Return the Gmail label id for label_name, creating it once if it
    doesn't exist yet. Safe to call every run — never creates a duplicate."""
    resp = session.get(f"{GMAIL_API_BASE}/labels", timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    for lbl in resp.json().get("labels", []):
        if lbl["name"].lower() == label_name.lower():
            return lbl["id"]

    logger.info("Gmail label %r not found — creating it.", label_name)
    resp = session.post(
        f"{GMAIL_API_BASE}/labels",
        json={"name": label_name, "labelListVisibility": "labelShow", "messageListVisibility": "show"},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()["id"]


def list_candidate_message_ids(session: AuthorizedSession, label_name: str, query: str = "") -> list[str]:
    """List up to the N most recent inbox messages (N = Settings ->
    Email Processing -> "max emails per sync", capped at Gmail's own 500/page
    max) that do NOT already carry label_name — a single page, newest-first,
    not a full-inbox scan. Filtering server-side via `-label:` (rather than
    fetching every message and checking its labels locally) means
    already-labeled messages never even count against that limit."""
    from services.settings_service import get_setting

    max_results = min(500, int(get_setting("max_emails_per_sync", default=500) or 500))
    q = f"-label:{label_name}" + (f" {query}" if query else "")
    params: dict = {"q": q, "labelIds": ["INBOX"], "maxResults": max_results}
    resp = session.get(f"{GMAIL_API_BASE}/messages", params=params, timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return [m["id"] for m in resp.json().get("messages", [])]


def list_all_labels(session: AuthorizedSession) -> list[dict]:
    """All Gmail labels on the account — powers the Settings label picker."""
    resp = session.get(f"{GMAIL_API_BASE}/labels", timeout=REQUEST_TIMEOUT)
    resp.raise_for_status()
    return [{"id": lbl["id"], "name": lbl["name"]} for lbl in resp.json().get("labels", [])]


def get_message_sender_and_labels(session: AuthorizedSession, msg_id: str) -> tuple[str, list[str]]:
    """Return (normalized sender email, current label ids) for one message.
    Fetches headers only (no body) — cheap enough for large inboxes."""
    resp = session.get(
        f"{GMAIL_API_BASE}/messages/{msg_id}",
        params={"format": "metadata", "metadataHeaders": ["From"]},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
    msg = resp.json()
    headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
    _, addr = parseaddr(headers.get("From", ""))
    return addr.strip().lower(), msg.get("labelIds", [])


def apply_label(session: AuthorizedSession, msg_id: str, label_id: str) -> None:
    resp = session.post(
        f"{GMAIL_API_BASE}/messages/{msg_id}/modify",
        json={"addLabelIds": [label_id]},
        timeout=REQUEST_TIMEOUT,
    )
    resp.raise_for_status()
