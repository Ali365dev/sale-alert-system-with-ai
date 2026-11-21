"""Retire push tokens whose app hasn't checked in for a long time.

The mobile app re-registers its token every time it comes to the
foreground (app_server/routers/devices.py), which refreshes last_seen_at.
A token unseen for STALE_TOKEN_DAYS belongs to an uninstalled app or an
abandoned install; FCM often still accepts sends to it, so without this it
keeps counting as a device. Re-registering reactivates it.
"""
from datetime import datetime, timedelta, timezone

from config import logger
from database.db import get_session
from database.models import DeviceToken

STALE_TOKEN_DAYS = 60
# Re-registering only started refreshing last_seen_at on this date (before
# it, last_seen_at stayed at the creation time even for live installs), so
# nothing is retired until a full STALE_TOKEN_DAYS of real data exists.
_LAST_SEEN_RELIABLE_SINCE = datetime(2026, 11, 21)


def deactivate_stale_tokens(days: int = STALE_TOKEN_DAYS) -> int:
    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=days)
    if cutoff < _LAST_SEEN_RELIABLE_SINCE:
        return 0
    with get_session() as session:
        count = (
            session.query(DeviceToken)
            .filter(DeviceToken.is_active.is_(True), DeviceToken.last_seen_at < cutoff)
            .update({"is_active": False}, synchronize_session=False)
        )
    if count:
        logger.info("Deactivated %d push token(s) unseen for %d+ days", count, days)
    return count
