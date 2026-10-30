"""
Brand offer cache — tracks when each brand was last checked.
Stored as a JSON file at cache/brand_offers.json.
"""
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

from config import BRAND_CACHE_HOURS, logger

_CACHE_DIR  = Path(__file__).parent.parent / "cache"
_CACHE_FILE = _CACHE_DIR / "brand_offers.json"
_DT_FMT     = "%Y-%m-%dT%H:%M:%S"


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def load() -> dict:
    """Load cache from disk. Returns empty dict if file is missing or corrupt."""
    try:
        if _CACHE_FILE.exists():
            return json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Cache load failed — starting fresh: %s", exc)
    return {}


def save(cache: dict) -> None:
    """Persist cache to disk."""
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _CACHE_FILE.write_text(
            json.dumps(cache, indent=2, default=str),
            encoding="utf-8",
        )
    except Exception as exc:
        logger.warning("Cache save failed: %s", exc)


def should_check(brand_name: str, cache: dict) -> bool:
    """Return True if brand is not cached or its next_check has passed."""
    entry = cache.get(brand_name)
    if not entry:
        return True
    try:
        next_check = datetime.strptime(str(entry["next_check"]), _DT_FMT)
        return _now() >= next_check
    except (KeyError, ValueError, TypeError):
        return True


def update(cache: dict, brand_name: str, success: bool, **meta) -> None:
    """Update a brand's cache entry in-place (call save() separately)."""
    now = _now()
    entry = cache.get(brand_name, {})
    entry["last_checked"] = now.strftime(_DT_FMT)
    entry["next_check"]   = (now + timedelta(hours=BRAND_CACHE_HOURS)).strftime(_DT_FMT)
    if success:
        entry["last_success"] = now.strftime(_DT_FMT)
    entry.update({k: v for k, v in meta.items() if v is not None})
    cache[brand_name] = entry


def get_entry(brand_name: str, cache: dict) -> Optional[dict]:
    return cache.get(brand_name)


def summary(cache: dict) -> dict:
    """Return a quick stats dict for logging/display."""
    total   = len(cache)
    due     = sum(1 for name in cache if should_check(name, cache))
    return {"total_cached": total, "due_for_check": due, "up_to_date": total - due}
