"""
OCR result cache — keyed by a hash of the image URL, so the same image is
never OCR'd twice. Stored as a JSON file at cache/ocr_results.json, mirroring
ai/cache.py's brand-offer cache (same load/save/update shape).

Unlike the brand cache, entries here have no TTL: an image at a given URL is
assumed to have fixed content, so once OCR'd it's cached indefinitely.
"""
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from config import logger

_CACHE_DIR  = Path(__file__).parent.parent / "cache"
_CACHE_FILE = _CACHE_DIR / "ocr_results.json"


def url_key(url: str) -> str:
    """Stable cache key for an image URL — also used to dedupe identical
    images referenced multiple times within (or across) an email."""
    return hashlib.sha256(url.encode("utf-8")).hexdigest()


def load() -> dict:
    """Load cache from disk. Returns empty dict if file is missing or corrupt."""
    try:
        if _CACHE_FILE.exists():
            return json.loads(_CACHE_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("OCR cache load failed — starting fresh: %s", exc)
    return {}


def save(cache: dict) -> None:
    """Persist cache to disk."""
    try:
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)
        _CACHE_FILE.write_text(json.dumps(cache, indent=2, default=str), encoding="utf-8")
    except Exception as exc:
        logger.warning("OCR cache save failed: %s", exc)


def get(url: str, cache: dict) -> Optional[dict]:
    """Cached OCR result for a URL, or None if not yet processed."""
    return cache.get(url_key(url))


def put(url: str, cache: dict, *, text: str, confidence: float, is_gif: bool, skipped: bool = False) -> None:
    """Record a URL's OCR result in-place (call save() separately)."""
    cache[url_key(url)] = {
        "url": url,
        "text": text,
        "confidence": confidence,
        "is_gif": is_gif,
        "skipped": skipped,
        "checked_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S"),
    }
