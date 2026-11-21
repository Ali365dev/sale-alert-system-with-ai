"""Hands background work to scraper_server — app_server runs no jobs of its
own (see .claude/rules/server-routing.md)."""
import json
import os
import threading
import urllib.error
import urllib.request

from config import logger
from services.settings_service import get_setting

_TRIGGER_TIMEOUT = 15


def _post(job_type: str, payload: dict) -> None:
    base_url = os.getenv("SCRAPER_SERVER_URL", "").rstrip("/")
    if not base_url:
        logger.warning("Skipping %s %s — SCRAPER_SERVER_URL is not set", job_type, payload)
        return

    req = urllib.request.Request(
        f"{base_url}/api/jobs/{job_type}/start",
        data=json.dumps(payload).encode(),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Internal-Secret": get_setting("internal_service_secret", default=""),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=_TRIGGER_TIMEOUT) as resp:
            logger.info("Triggered %s on scraper_server %s (%s)", job_type, payload, resp.status)
    except urllib.error.HTTPError as exc:
        logger.warning("Failed to trigger %s %s: HTTP %s", job_type, payload, exc.code)
    except Exception as exc:
        logger.warning("Failed to trigger %s %s: %s", job_type, payload, exc)


def trigger_job(job_type: str, payload: dict) -> None:
    """Fire-and-forget, so a slow or sleeping scraper never blocks the request."""
    threading.Thread(target=_post, args=(job_type, payload), daemon=True).start()
