"""Offer lifecycle: retention (deleteAfter) and display status.

Both are pure functions of expiry_date/received_at so they can be computed
once at write time (delete_after — stored, drives the cleanup job) or cheaply
at read time (status — never stored, so it can't go stale). Datetimes here
follow the rest of the codebase's convention: naive Python datetimes that
always represent UTC (see database.models._utcnow), never tz-aware — so they
compare cleanly with every other stored timestamp.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from config import OFFER_RETENTION_AFTER_EXPIRY_DAYS, OFFER_RETENTION_NO_EXPIRY_DAYS


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def compute_delete_after(expiry_date: Optional[datetime], received_at: datetime) -> datetime:
    """expiry_date + N days if the offer has one, else received_at + M days."""
    if expiry_date is not None:
        return expiry_date + timedelta(days=OFFER_RETENTION_AFTER_EXPIRY_DAYS)
    return received_at + timedelta(days=OFFER_RETENTION_NO_EXPIRY_DAYS)


def compute_offer_status(expiry_date: Optional[datetime], now: Optional[datetime] = None) -> str:
    """"active" | "expired" | "no_expiry" — display-only, never drives deletion."""
    if expiry_date is None:
        return "no_expiry"
    now = now or utcnow()
    return "active" if expiry_date > now else "expired"
