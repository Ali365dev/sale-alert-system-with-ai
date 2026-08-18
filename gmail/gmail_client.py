"""
Manages Gmail OAuth2 authentication and returns an authorised service object.

First run:  opens a browser window for the user to authorise access.
Subsequent: refreshes the token automatically using the saved token.

The token is stored two places:
  - The `Setting` DB row "gmail_oauth_token" (Fernet-encrypted, same scheme
    api/settings.py's API keys use) — the source of truth. This is what
    makes the token survive a redeploy/restart on hosts with no persistent
    disk (e.g. Render's free tier).
  - GMAIL_TOKEN_FILE, best-effort — kept only for local-dev convenience
    (inspecting the raw file) and to pick up a token someone dropped there
    manually before the DB row exists yet.

If the refresh token itself has been revoked or expired, the stale token is
discarded and the browser consent flow runs again.
"""
import json
import os
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config import GMAIL_CREDENTIALS_FILE, GMAIL_CREDENTIALS_JSON, GMAIL_TOKEN_FILE, GMAIL_SCOPES, logger

GMAIL_TOKEN_SETTING_KEY = "gmail_oauth_token"


def _load_creds_from_db() -> Credentials | None:
    from services.settings_service import get_setting, decrypt_key

    encrypted = get_setting(GMAIL_TOKEN_SETTING_KEY)
    if not encrypted:
        return None
    try:
        raw = decrypt_key(encrypted)
        return Credentials.from_authorized_user_info(json.loads(raw), GMAIL_SCOPES)
    except Exception as exc:
        logger.warning("Gmail: stored token could not be read (%s) — will re-authorise.", exc)
        return None


def _save_creds(creds: Credentials) -> None:
    from services.settings_service import set_setting, encrypt_key

    set_setting(GMAIL_TOKEN_SETTING_KEY, encrypt_key(creds.to_json()), category="gmail")
    try:
        with open(GMAIL_TOKEN_FILE, "w") as fh:
            fh.write(creds.to_json())
    except OSError:
        pass  # read-only filesystem (e.g. Render free tier) — DB row is authoritative


def is_connected() -> bool:
    from services.settings_service import get_setting

    return bool(get_setting(GMAIL_TOKEN_SETTING_KEY)) or os.path.exists(GMAIL_TOKEN_FILE)


def disconnect() -> None:
    from services.settings_service import set_setting

    set_setting(GMAIL_TOKEN_SETTING_KEY, "", category="gmail")
    if os.path.exists(GMAIL_TOKEN_FILE):
        os.remove(GMAIL_TOKEN_FILE)


def get_credentials() -> Credentials:
    """Return valid Gmail OAuth2 credentials, refreshing or re-authorising as needed."""
    creds = _load_creds_from_db()

    # Fall back to the file only if the DB has nothing yet (e.g. a token
    # dropped in manually before this app has ever saved to the DB).
    if creds is None and os.path.exists(GMAIL_TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(GMAIL_TOKEN_FILE, GMAIL_SCOPES)

    # Refresh or obtain new credentials
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logger.info("Refreshing expired Gmail token …")
            try:
                creds.refresh(Request())
            except RefreshError:
                logger.warning(
                    "Refresh token is expired or revoked; re-authorising from scratch."
                )
                creds = None

        if not creds:
            logger.info("Starting OAuth2 browser flow …")
            if GMAIL_CREDENTIALS_JSON:
                flow = InstalledAppFlow.from_client_config(
                    json.loads(GMAIL_CREDENTIALS_JSON), GMAIL_SCOPES
                )
            else:
                if not os.path.exists(GMAIL_CREDENTIALS_FILE):
                    raise FileNotFoundError(
                        f"credentials.json not found at '{GMAIL_CREDENTIALS_FILE}' and "
                        "GMAIL_CREDENTIALS_JSON is not set. Download it from Google Cloud "
                        "Console → APIs & Services → Credentials."
                    )
                flow = InstalledAppFlow.from_client_secrets_file(
                    GMAIL_CREDENTIALS_FILE, GMAIL_SCOPES
                )
            creds = flow.run_local_server(port=0)

        # Persist for future runs
        _save_creds(creds)
        logger.info("Gmail token saved.")
    elif creds:
        # Still valid — if it only came from the file (DB row missing/empty),
        # backfill the DB now so future restarts don't depend on the file.
        from services.settings_service import get_setting

        if not get_setting(GMAIL_TOKEN_SETTING_KEY):
            _save_creds(creds)

    return creds


def get_gmail_service():
    """Return an authenticated Gmail API service object."""
    creds = get_credentials()
    try:
        service = build("gmail", "v1", credentials=creds, cache_discovery=False)
        logger.info("Gmail API service ready.")
        return service
    except HttpError as exc:
        logger.error("Failed to build Gmail service: %s", exc)
        raise
