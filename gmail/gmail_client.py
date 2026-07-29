"""
Manages Gmail OAuth2 authentication and returns an authorised service object.

First run:  opens a browser window for the user to authorise access.
Subsequent: refreshes the token automatically using the saved token.json.
If the refresh token itself has been revoked or expired, the stale
token.json is discarded and the browser consent flow runs again.
"""
import os
from google.auth.exceptions import RefreshError
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from config import GMAIL_CREDENTIALS_FILE, GMAIL_TOKEN_FILE, GMAIL_SCOPES, logger


def get_credentials() -> Credentials:
    """Return valid Gmail OAuth2 credentials, refreshing or re-authorising as needed."""
    creds: Credentials | None = None

    # Reuse saved token when available
    if os.path.exists(GMAIL_TOKEN_FILE):
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
                os.remove(GMAIL_TOKEN_FILE)
                creds = None

        if not creds:
            if not os.path.exists(GMAIL_CREDENTIALS_FILE):
                raise FileNotFoundError(
                    f"credentials.json not found at '{GMAIL_CREDENTIALS_FILE}'. "
                    "Download it from Google Cloud Console → APIs & Services → Credentials."
                )
            logger.info("Starting OAuth2 browser flow …")
            flow = InstalledAppFlow.from_client_secrets_file(
                GMAIL_CREDENTIALS_FILE, GMAIL_SCOPES
            )
            creds = flow.run_local_server(port=0)

        # Persist for future runs
        with open(GMAIL_TOKEN_FILE, "w") as fh:
            fh.write(creds.to_json())
        logger.info("Gmail token saved to %s", GMAIL_TOKEN_FILE)

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
