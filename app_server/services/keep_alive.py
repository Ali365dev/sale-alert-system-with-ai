"""Pings the scraper server periodically to prevent Render free-tier sleep.

The scraper server has no scheduler of its own, so the app server does the
mutual pinging: it hits the scraper's /api/health every 10 minutes, and the
scraper server runs its own symmetric ping back (see scraper_server/services/keep_alive.py).

Set SCRAPER_SERVER_URL in the environment to the deployed scraper URL
(e.g. https://sales-alert-scraper.onrender.com). Omit it locally — pings
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
    url = os.getenv("SCRAPER_SERVER_URL", "").rstrip("/")
    if not url:
        logger.debug("Keep-alive: SCRAPER_SERVER_URL not set — skipping partner ping")
        return
    health_url = f"{url}/api/health"
    t = threading.Thread(target=_ping_loop, args=(health_url,), daemon=True, name="keep-alive-scraper")
    t.start()
    logger.info("Keep-alive: will ping %s every %d min", health_url, _INTERVAL_SECONDS // 60)
