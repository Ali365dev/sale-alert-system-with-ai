"""Small retry-with-exponential-backoff helper for transient network/API failures."""
import time
from typing import Callable, TypeVar

import requests

from config import logger

T = TypeVar("T")

# Errors worth retrying — timeouts, connection drops, 5xx-ish transport failures.
# Anything else (bad JSON, auth errors, 4xx) is treated as a real failure and
# surfaces immediately instead of burning retry budget.
RETRYABLE_EXCEPTIONS = (
    requests.exceptions.Timeout,
    requests.exceptions.ConnectionError,
    requests.exceptions.ChunkedEncodingError,
)


def retry_with_backoff(
    fn: Callable[[], T],
    attempts: int = 3,
    base_delay: float = 1.0,
    retryable: tuple = RETRYABLE_EXCEPTIONS,
    label: str = "operation",
) -> T:
    """Call fn(), retrying on retryable exceptions with exponential backoff
    (base_delay, base_delay*2, base_delay*4, ...). Re-raises the last error
    if every attempt fails."""
    last_exc: Exception | None = None
    for attempt in range(1, attempts + 1):
        try:
            return fn()
        except retryable as exc:
            last_exc = exc
            if attempt == attempts:
                break
            delay = base_delay * (2 ** (attempt - 1))
            logger.warning(
                "%s failed (attempt %d/%d): %s — retrying in %.1fs",
                label, attempt, attempts, exc, delay,
            )
            time.sleep(delay)
    raise last_exc
