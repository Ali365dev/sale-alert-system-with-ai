"""Deterministic resolution of relative expiry phrases ("tomorrow", "this
weekend", "next Sunday", "valid for 3 days"...) into concrete calendar dates.

The AI (ai/analyzer.py) only classifies and extracts the raw phrase — it never
does the date arithmetic itself, since LLM weekday/interval math is not
reliable enough for something a cleanup job will act on. This module does the
math in plain Python, always anchored to the email's received_at, never to
whenever this code happens to run.
"""
import re
from datetime import datetime, timedelta
from typing import Optional

_WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}


def _end_of_day(d: datetime) -> datetime:
    return d.replace(hour=23, minute=59, second=59, microsecond=0)


def _next_weekday(reference: datetime, target: int, *, strictly_next_week: bool) -> datetime:
    """Closest date on/after reference's date that falls on the `target`
    weekday. If strictly_next_week, always roll into the following week even
    if reference itself is already that weekday (used for "next <day>" vs.
    the inclusive-of-today "ends <day>")."""
    days_ahead = (target - reference.weekday()) % 7
    if strictly_next_week and days_ahead == 0:
        days_ahead = 7
    return reference + timedelta(days=days_ahead)


def resolve_relative_expiry(phrase: Optional[str], received_at: datetime) -> Optional[datetime]:
    """Resolve a relative expiry phrase into a concrete end-of-day datetime,
    anchored to received_at. Returns None if the phrase doesn't match any
    known pattern — callers must treat that as "no expiry", never guess."""
    if not phrase:
        return None
    text = f" {phrase.strip().lower()} "

    m = re.search(r"\b(\d+)\s*day", text)
    if m:
        return _end_of_day(received_at + timedelta(days=int(m.group(1))))

    if re.search(r"\btonight\b|\btoday\b", text):
        return _end_of_day(received_at)

    if re.search(r"\btomorrow\b", text):
        return _end_of_day(received_at + timedelta(days=1))

    if re.search(r"\bweekend\b", text):
        return _end_of_day(_next_weekday(received_at, _WEEKDAYS["sunday"], strictly_next_week=False))

    for name, idx in _WEEKDAYS.items():
        if re.search(rf"\b{name}\b", text):
            strictly_next = bool(re.search(r"\bnext\b", text))
            return _end_of_day(_next_weekday(received_at, idx, strictly_next_week=strictly_next))

    return None
