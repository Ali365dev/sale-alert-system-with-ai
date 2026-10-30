"""Pings the app server periodically to prevent Render free-tier sleep.

Set APP_SERVER_URL in the environment to the deployed app server URL
(e.g. https://sales-alert-app.onrender.com). Omit it locally — pings
are skipped when the URL is not set, to avoid spurious noise in dev.
"""
import os
import threading
import time

from config import logger

_INTERVAL_SECONDS = 10 * 60  # 10 minutes


def _ping_loop(url: str) -> None:
    while True:
        time.sleep(_INTERVAL_SECONDS)
        try:
            import urllib.request
            with urllib.request.urlopen(url, timeout=15) as resp:
                logger.debug("Keep-alive ping → %s  status=%s", url, resp.status)
        except Exception as exc:
            logger.warning("Keep-alive ping → %s failed: %s", url, exc)


def start_keep_alive() -> None:
    url = os.getenv("APP_SERVER_URL", "").rstrip("/")
    if not url:
        logger.debug("Keep-alive: APP_SERVER_URL not set — skipping partner ping")
        return
    health_url = f"{url}/api/health"
    t = threading.Thread(target=_ping_loop, args=(health_url,), daemon=True, name="keep-alive-app")
    t.start()
    logger.info("Keep-alive: will ping %s every %d min", health_url, _INTERVAL_SECONDS // 60)
