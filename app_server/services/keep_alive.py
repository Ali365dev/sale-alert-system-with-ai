import os
import threading
import time
import urllib.request

from config import logger

_INTERVAL = 4 * 60   # 4 min — well under Render's 15-min sleep threshold
_TIMEOUT  = 60       # 60 s — enough time for a cold-start wakeup


def _ping(url: str) -> None:
    try:
        with urllib.request.urlopen(url, timeout=_TIMEOUT) as resp:
            logger.debug("keep-alive ✓ %s  %s", url, resp.status)
    except Exception as exc:
        logger.warning("keep-alive ✗ %s  %s", url, exc)


def _loop(urls: list[str]) -> None:
    while True:
        for url in urls:
            _ping(url)
        time.sleep(_INTERVAL)


def start_keep_alive() -> None:
    urls = []

    self_url = os.getenv("APP_SERVER_URL", "").rstrip("/")
    if self_url:
        urls.append(f"{self_url}/api/health")

    partner_url = os.getenv("SCRAPER_SERVER_URL", "").rstrip("/")
    if partner_url:
        urls.append(f"{partner_url}/api/health")

    if not urls:
        logger.debug("keep-alive: no URLs configured — skipping")
        return

    # Ping immediately so servers are warm right after deploy
    for url in urls:
        threading.Thread(target=_ping, args=(url,), daemon=True).start()

    t = threading.Thread(target=_loop, args=(urls,), daemon=True, name="keep-alive")
    t.start()
    logger.info("keep-alive: pinging %s every %d min", urls, _INTERVAL // 60)
