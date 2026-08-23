"""
AI provider abstraction: provider-level priority + per-provider API key
rotation, fully independent of each other.

Provider priority — configurable in Settings (provider_order / provider_enabled),
default gemini -> groq -> ollama:
    Determines which provider is tried first, and (on total exhaustion) which
    is tried next. Re-prioritizing/enabling/disabling in Settings takes effect
    on the very next call, no restart needed.

Per-provider API key rotation — configurable in Settings (each ApiKey's
`priority`, position 0 = "current active key"):
    Every provider backed by stored keys (Gemini, Groq, ...) tries its active
    key first, then every other enabled/non-invalid/non-cooling-down key for
    that SAME provider, in priority order, before ever giving up on that
    provider. Changing a provider's active key never touches provider order,
    and reordering providers never touches any provider's active key — see
    services/settings_service.py's `reorder_api_keys` for the key-side half
    of this and api/settings.py's /providers endpoints for the provider-side
    half.

Failover trigger (both levels): rate-limit / quota / auth / timeout /
server-unavailable / network errors — see `classify_error()` below, which is
the single source of truth for both the human-readable failure reason shown
in job logs and the retryable/non-retryable decision. Any error classify_error
marks non-retryable (e.g. a malformed prompt, which fails the same way on
every provider/key) is surfaced immediately and does NOT burn through
remaining keys or advance to the next provider.

Per-key cooldown: a key that just failed with a retryable error is put on
cooldown (skipped by future calls, this process only) for either the
provider-reported Retry-After/retryDelay if one was present, or
_KEY_COOLDOWN_SECONDS otherwise — it is not permanently disabled, and becomes
eligible again once the cooldown elapses. A key is only marked permanently
`invalid` (excluded from get_active_api_keys entirely) for an auth failure
(401/403) — the key itself is bad, waiting won't fix it.

Provider health/cooldown: once every eligible key for a provider has been
tried and failed (or none are eligible — all cooling down / none configured),
that provider is put on cooldown (skipped by future calls) for
_COOLDOWN_SECONDS, then eligible again. Purely in-memory/per-process — a
restart clears both provider- and key-level cooldowns.

Observability: `call()` accepts an optional `on_event(dict)` callback, invoked
synchronously for every key/provider failure and switch — job pipelines (see
services/email_sync.py, services/jobs/process_pending.py) use this to log
real-time "switching provider/key" lines without ai/providers.py knowing
anything about jobs, subjects, or job_ids. Callers that don't pass on_event
(brand research, verification, etc.) see no behavior change.

Adding a new provider:
    1. Subclass Provider, set `name` and `uses_stored_keys`.
    2. If uses_stored_keys: implement `_model()` and `_call_one(prompt, raw_key, model)`.
       If not (e.g. a local model): implement `call(prompt, on_event=None)` directly.
    3. Register an instance in _REGISTRY and its name in DEFAULT_PROVIDER_ORDER.
    No other changes needed — Settings UI and failover pick it up automatically.
"""
import json
import re
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Optional

from config import (
    GEMINI_API_KEY, GEMINI_MODEL,
    GROQ_API_KEY,   GROQ_MODEL,
    OLLAMA_BASE_URL, OLLAMA_MODEL,
    BRAND_RETRY_COUNT,
    logger,
)

OnEvent = Optional[Callable[[dict], None]]

_STATE_FILE = Path(__file__).parent.parent / "cache" / "provider_state.json"
_TRANSIENT_RETRIES = BRAND_RETRY_COUNT  # retries within a single key for non-rotatable transient errors
_COOLDOWN_SECONDS = 300      # how long a fully-exhausted provider is skipped before being retried again
_KEY_COOLDOWN_SECONDS = 60   # default per-key cooldown when the provider gave no Retry-After/retryDelay


def _emit(on_event: OnEvent, event: dict) -> None:
    if on_event is None:
        return
    try:
        on_event(event)
    except Exception:
        logger.exception("on_event callback raised — ignoring, must not break the AI call")


# ── Error classification — single source of truth for both the human-readable
#    reason shown in job logs and the retryable/non-retryable decision ────────

@dataclass
class ErrorInfo:
    reason: str            # human-readable, e.g. "API rate limit exceeded"
    code: str               # "429" | "401" | "403" | "timeout" | "5xx status" | "network" | "unknown"
    retryable: bool          # should this failure rotate to the next key/provider?
    retry_after: Optional[float] = None  # seconds, if the provider told us (Retry-After / retryDelay)


_QUOTA_EXC_NAMES = frozenset({"ResourceExhausted", "QuotaExceeded"})
_QUOTA_PHRASES = ("quota exceeded", "quota_exceeded", "resource_exhausted", "resource exhausted")

_RATE_LIMIT_EXC_NAMES = frozenset({"RateLimitError", "TooManyRequestsError", "RateLimitExceeded"})
_RATE_LIMIT_PHRASES = ("rate limit", "rate_limit", "too many requests", "ratelimitexceeded")

_AUTH401_EXC_NAMES = frozenset({"AuthenticationError", "Unauthenticated"})
_AUTH401_PHRASES = ("api key not valid", "invalid api key", "invalid_api_key", "unauthenticated", "incorrect api key")

_AUTH403_EXC_NAMES = frozenset({"PermissionDenied", "PermissionDeniedError"})
_AUTH403_PHRASES = ("permission denied", "permission_denied", "access denied", "forbidden")

_TIMEOUT_EXC_NAMES = frozenset({"Timeout", "DeadlineExceeded", "ReadTimeout", "ConnectTimeout", "APITimeoutError"})
_TIMEOUT_PHRASES = ("timeout", "timed out", "deadline exceeded", "deadline_exceeded")

_SERVER_EXC_NAMES = frozenset({"ServerError", "InternalServerError", "ServiceUnavailable"})
_SERVER_PHRASES = ("internal error", "service unavailable", "bad gateway", "server error")

_NETWORK_EXC_NAMES = frozenset({
    "ConnectionError", "ConnectError", "APIConnectionError", "NewConnectionError", "MaxRetryError", "ConnectionResetError",
})
_NETWORK_PHRASES = (
    "connection error", "connection refused", "connection reset", "network is unreachable",
    "failed to establish a new connection", "name or service not known", "econnrefused",
)

# Combined — used only by is_rate_limit_message() for the plain-text-only
# checks Settings needs (e.g. ApiKey.last_error, which has no exception object).
_RATE_LIMIT_OR_QUOTA_PHRASES = ("429",) + _RATE_LIMIT_PHRASES + _QUOTA_PHRASES

_RETRY_AFTER_RE = re.compile(r"retry[-_ ]?after[\"'\s:]*([0-9]+(?:\.[0-9]+)?)", re.IGNORECASE)
_RETRY_DELAY_RE = re.compile(r"retrydelay[\"'\s:]*\"?([0-9]+(?:\.[0-9]+)?)", re.IGNORECASE)


def is_rate_limit_message(text: str | None) -> bool:
    """Phrase-only check, for plain error strings (e.g. ApiKey.last_error)
    where no exception object/type is available. Covers rate-limit AND quota
    phrasing — Settings only needs "is this key temporarily throttled",
    not the finer-grained reason categories classify_error() distinguishes."""
    if not text:
        return False
    text = text.lower()
    return any(phrase in text for phrase in _RATE_LIMIT_OR_QUOTA_PHRASES)


def _status_code(exc: Exception) -> Optional[int]:
    """Most authoritative signal, when the SDK provides it: Groq's SDK
    (openai-style) sets .status_code; google-genai's errors set .code;
    requests.HTTPError exposes it via .response.status_code."""
    for attr in ("status_code", "code"):
        value = getattr(exc, attr, None)
        if isinstance(value, int):
            return value
    response = getattr(exc, "response", None)
    value = getattr(response, "status_code", None)
    if isinstance(value, int):
        return value
    return None


def _extract_retry_after(exc: Exception) -> Optional[float]:
    """Best-effort Retry-After extraction: an HTTP response header if the
    exception carries one, else a retryDelay/Retry-After mentioned in the
    error body/message text (Gemini embeds retryDelay in the error details).
    None if the provider didn't tell us — caller falls back to a default."""
    response = getattr(exc, "response", None)
    headers = getattr(response, "headers", None)
    if headers is not None:
        for key in ("Retry-After", "retry-after"):
            try:
                value = headers.get(key)
            except Exception:
                value = None
            if value:
                try:
                    return float(value)
                except (TypeError, ValueError):
                    pass
    text = str(exc)
    match = _RETRY_AFTER_RE.search(text) or _RETRY_DELAY_RE.search(text)
    if match:
        try:
            return float(match.group(1))
        except (TypeError, ValueError):
            pass
    return None


def classify_error(exc: Exception) -> ErrorInfo:
    """Maps any exception raised by a Provider._call_one to a human-readable
    reason + short code + whether it should trigger key/provider rotation.

    Status code (when the SDK provides one) is checked before name/phrase
    heuristics — it's the actual signal the provider sent, not a guess.
    Category order matters where categories could overlap (e.g. Gemini
    reports both per-minute throttling and daily quota exhaustion as the
    same 429/RESOURCE_EXHAUSTED shape) — quota is checked first since it's
    the more specific/common case for that provider.
    """
    name = type(exc).__name__
    text = str(exc).lower()
    code = _status_code(exc)
    retry_after = _extract_retry_after(exc)

    def matches(names, phrases):
        return name in names or any(p in text for p in phrases)

    if matches(_QUOTA_EXC_NAMES, _QUOTA_PHRASES):
        return ErrorInfo("API quota exceeded", "429", True, retry_after)
    if code == 429 or matches(_RATE_LIMIT_EXC_NAMES, _RATE_LIMIT_PHRASES):
        return ErrorInfo("API rate limit exceeded", "429", True, retry_after)
    if code == 401 or matches(_AUTH401_EXC_NAMES, _AUTH401_PHRASES):
        return ErrorInfo("Invalid API key", "401", True, retry_after)
    if code == 403 or matches(_AUTH403_EXC_NAMES, _AUTH403_PHRASES):
        return ErrorInfo("API access denied", "403", True, retry_after)
    if matches(_TIMEOUT_EXC_NAMES, _TIMEOUT_PHRASES):
        return ErrorInfo("Request timeout", "timeout", True, retry_after)
    if (code is not None and 500 <= code < 600) or matches(_SERVER_EXC_NAMES, _SERVER_PHRASES):
        return ErrorInfo("Provider service unavailable", str(code) if code else "5xx", True, retry_after)
    if matches(_NETWORK_EXC_NAMES, _NETWORK_PHRASES):
        return ErrorInfo("Network error", "network", True, retry_after)
    return ErrorInfo("Unknown API error", "unknown", False, retry_after)


def _is_key_rotatable(exc: Exception) -> bool:
    """Whether a single-key failure should move on to the next key/provider
    rather than propagating immediately."""
    return classify_error(exc).retryable


def short_reason(reason: str) -> str:
    """"API rate limit exceeded" -> "rate limit exceeded", for the compact
    "{key} {reason}" switch-log wording — the full "API ..." phrasing is used
    for the "Reason: ..." line on a final failure instead."""
    return reason[4:] if reason.startswith("API ") else reason


class _AllKeysExhausted(Exception):
    """Raised once every eligible stored key for a provider has been tried
    and failed (or none were eligible — none configured, or all cooling
    down). ProviderManager catches this specifically to always advance to
    the next provider, carrying the last key's classified reason/code so the
    provider-level job-log line and the final structured failure info don't
    have to re-parse a message string."""

    def __init__(self, message: str, reason: str = "Unknown API error", code: str = "unknown",
                 key_identifier: Optional[str] = None, attempts: int = 0):
        super().__init__(message)
        self.reason = reason
        self.code = code
        self.key_identifier = key_identifier
        self.attempts = attempts


# ── Per-key cooldown tracker ─────────────────────────────────────────────────

class _KeyCooldowns:
    """In-memory, per-process cooldown state for individual API keys —
    mirrors ProviderManager's provider-level cooldown but one level down.
    Keyed by (provider, key_id_or_name) so the `.env`-fallback pseudo-key
    (id=None) never collides across providers."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._until: dict[tuple, float] = {}
        self._reason: dict[tuple, str] = {}

    @staticmethod
    def _key(provider: str, key_info: dict) -> tuple:
        return (provider, key_info["id"] if key_info["id"] is not None else key_info["name"])

    def is_cooling(self, provider: str, key_info: dict) -> bool:
        with self._lock:
            return time.monotonic() < self._until.get(self._key(provider, key_info), 0.0)

    def cool_down(self, provider: str, key_info: dict, seconds: float, reason: str) -> None:
        with self._lock:
            k = self._key(provider, key_info)
            self._until[k] = time.monotonic() + seconds
            self._reason[k] = reason

    def clear(self, provider: str, key_info: dict) -> None:
        with self._lock:
            self._until.pop(self._key(provider, key_info), None)
            self._reason.pop(self._key(provider, key_info), None)

    def last_reason(self, provider: str, key_info: dict) -> Optional[str]:
        with self._lock:
            return self._reason.get(self._key(provider, key_info))

    def state_for(self, provider: str, keys: list[dict]) -> list[dict]:
        """Settings-facing snapshot — Status/Available/Retry-After per key."""
        now = time.monotonic()
        result = []
        with self._lock:
            for key_info in keys:
                k = self._key(provider, key_info)
                until = self._until.get(k)
                cooling = until is not None and now < until
                result.append({
                    "key_identifier": key_info["name"],
                    "status": "RATE_LIMITED" if cooling else "AVAILABLE",
                    "available": not cooling,
                    "retry_after_seconds": round(until - now, 1) if cooling else None,
                    "last_reason": self._reason.get(k) if cooling else None,
                })
        return result


_key_cooldowns = _KeyCooldowns()


# ── Provider base class ────────────────────────────────────────────────────────

class Provider(ABC):
    name: str
    uses_stored_keys: bool = False  # True: backed by database.models.ApiKey rows (rotated automatically)

    @abstractmethod
    def call(self, prompt: str, on_event: OnEvent = None) -> str:
        """
        Send prompt and return the response text.
        Rotatable errors (see classify_error) are propagated as
        _AllKeysExhausted once every eligible key/attempt is spent; other
        errors propagate as-is and must NOT trigger key rotation or provider
        failover. `on_event` (optional) is invoked for every key failure/
        switch — see module docstring for the event shapes.
        """


# ── Shared key-rotation loop — used by every uses_stored_keys provider ──────────

def _call_with_key_rotation(provider: "Provider", prompt: str, env_fallback_key: str | None, on_event: OnEvent = None) -> str:
    """Try `provider`'s current active key (Settings > that provider's key
    list, priority 0), then every other enabled/non-invalid/non-cooling-down
    key for the same provider in priority order. Only after all eligible keys
    are exhausted does this raise _AllKeysExhausted, signalling
    ProviderManager to move to the next provider in priority order."""
    from services import settings_service

    all_keys = settings_service.get_active_api_keys(provider.name)
    if not all_keys and env_fallback_key:
        # No keys added in Settings yet — fall back to .env so existing
        # deployments keep working unchanged until someone migrates.
        all_keys = [{"id": None, "name": "env (.env fallback)", "decrypted_key": env_fallback_key}]
    eligible = [k for k in all_keys if not _key_cooldowns.is_cooling(provider.name, k)]

    if not all_keys:
        raise _AllKeysExhausted(
            f"{provider.name} not configured — no active key and no .env fallback",
            reason="Unknown API error", code="unconfigured", attempts=0,
        )
    if not eligible:
        # Every key was already put on cooldown by a previous call — reuse
        # whatever it was cooled down FOR (rate limit, 503, etc.) rather than
        # assuming rate-limit; that's what a plain "no keys configured" case
        # falls back to below since there's no prior reason to report.
        last_cooldown_reason = _key_cooldowns.last_reason(provider.name, all_keys[0]) or "API rate limit exceeded"
        raise _AllKeysExhausted(
            f"All {provider.name} keys are cooling down — last reason: {last_cooldown_reason}",
            reason=last_cooldown_reason, code="cooldown",
            key_identifier=all_keys[0]["name"], attempts=0,
        )

    model = provider._model()  # type: ignore[attr-defined]
    last_info = ErrorInfo("Unknown API error", "unknown", False)
    last_key_name = eligible[-1]["name"]
    tried = 0

    for idx, key_info in enumerate(eligible):
        tried += 1
        try:
            result = provider._call_one(prompt, key_info["decrypted_key"], model)  # type: ignore[attr-defined]
            if key_info["id"] is not None:
                settings_service.record_key_usage(key_info["id"])
            _key_cooldowns.clear(provider.name, key_info)
            return result
        except Exception as exc:
            info = classify_error(exc)
            last_info = info
            last_key_name = key_info["name"]
            if key_info["id"] is not None:
                # 401/403 are the only permanent (per stored-key) failures — everything
                # else (rate limit/quota/timeout/5xx/network) is a temporary cooldown,
                # never a permanent "invalid" mark (see module docstring).
                settings_service.record_key_failure(key_info["id"], info.reason, mark_invalid=info.code in ("401", "403"))

            if not info.retryable:
                logger.error("Non-retryable error on %s key %r: %s", provider.name, key_info["name"], exc)
                raise  # e.g. malformed request — don't burn through every key for it

            cooldown = info.retry_after or _KEY_COOLDOWN_SECONDS
            _key_cooldowns.cool_down(provider.name, key_info, cooldown, info.reason)
            logger.warning(
                "%s key %r failed (%s: %s) — cooling down %.0fs", provider.name, key_info["name"], info.code, info.reason, cooldown,
            )

            has_next = idx + 1 < len(eligible)
            if has_next:
                next_key = eligible[idx + 1]
                _emit(on_event, {
                    "type": "key_failed", "provider": provider.name, "key": key_info["name"],
                    "reason": info.reason, "code": info.code, "retry_after": info.retry_after,
                })
                _emit(on_event, {"type": "key_switch", "provider": provider.name, "to_key": next_key["name"]})
            # else: don't log a per-key event here — the provider-level
            # exhaustion below (raised as _AllKeysExhausted) covers it at
            # provider granularity, matching the "⚠ {Provider} {reason}"
            # job-log convention instead of a redundant per-key line.
            continue

    raise _AllKeysExhausted(
        f"All {provider.name} keys exhausted — last error: {last_info.reason}",
        reason=last_info.reason, code=last_info.code, key_identifier=last_key_name, attempts=tried,
    )


# ── Concrete providers ─────────────────────────────────────────────────────────

class GeminiProvider(Provider):
    name = "gemini"
    uses_stored_keys = True

    def _model(self) -> str:
        from services import settings_service

        return settings_service.get_setting("gemini_model", default=GEMINI_MODEL)

    def _call_one(self, prompt: str, raw_key: str, model: str) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=raw_key)
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        return response.text

    def call(self, prompt: str, on_event: OnEvent = None) -> str:
        return _call_with_key_rotation(self, prompt, GEMINI_API_KEY, on_event)


class GroqProvider(Provider):
    name = "groq"
    uses_stored_keys = True

    def _model(self) -> str:
        from services import settings_service

        return settings_service.get_setting("groq_model", default=GROQ_MODEL)

    def _call_one(self, prompt: str, raw_key: str, model: str) -> str:
        from groq import Groq

        client = Groq(api_key=raw_key)
        last_exc: Exception = RuntimeError("no attempts made")
        for attempt in range(1, _TRANSIENT_RETRIES + 1):
            try:
                completion = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                )
                return completion.choices[0].message.content
            except Exception as exc:
                # Rotatable errors (rate-limit/quota/auth/timeout/5xx/network) are not
                # transient in the "retry the same key" sense — retrying locally won't
                # help, let the caller decide whether to rotate to the next key.
                if _is_key_rotatable(exc):
                    raise
                last_exc = exc
                logger.warning("Groq transient error (attempt %d/%d): %s", attempt, _TRANSIENT_RETRIES, exc)
                if attempt < _TRANSIENT_RETRIES:
                    time.sleep(2 ** attempt)
        raise last_exc

    def call(self, prompt: str, on_event: OnEvent = None) -> str:
        return _call_with_key_rotation(self, prompt, GROQ_API_KEY, on_event)


class OllamaProvider(Provider):
    name = "ollama"
    uses_stored_keys = False  # local model — no stored key to rotate

    def call(self, prompt: str, on_event: OnEvent = None) -> str:
        from services import settings_service

        base_url = settings_service.get_setting("ollama_base_url", default=OLLAMA_BASE_URL)
        model = settings_service.get_setting("ollama_model", default=OLLAMA_MODEL)

        import requests as _req
        url = f"{base_url.rstrip('/')}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.2},
        }
        last_exc: Exception = RuntimeError("no attempts made")
        for attempt in range(1, _TRANSIENT_RETRIES + 1):
            try:
                resp = _req.post(url, json=payload, timeout=120)
                resp.raise_for_status()
                return resp.json().get("response", "")
            except Exception as exc:
                if _is_key_rotatable(exc):
                    raise
                # 4xx client errors (404 model not found, 400 bad request, etc.) that
                # classify_error doesn't consider rotatable are not transient either.
                response = getattr(exc, "response", None)
                status = getattr(response, "status_code", None)
                if status is not None and 400 <= status < 500:
                    logger.error("Ollama client error (not retrying): %s", exc)
                    raise
                last_exc = exc
                logger.warning("Ollama transient error (attempt %d/%d): %s", attempt, _TRANSIENT_RETRIES, exc)
                if attempt < _TRANSIENT_RETRIES:
                    time.sleep(2 ** attempt)
        raise last_exc


# ── Provider registry & priority order ──────────────────────────────────────

# Every known LLM provider, keyed by name — add new providers here, nowhere
# else. This is the fixed set of *available* providers; the *order* and
# *enabled* state are configurable via Settings, separately below.
_REGISTRY: dict[str, Provider] = {
    "gemini": GeminiProvider(),
    "groq": GroqProvider(),
    "ollama": OllamaProvider(),
}

_DISPLAY_NAMES: dict[str, str] = {"gemini": "Gemini", "groq": "Groq", "ollama": "Ollama"}


def display_name(provider: str) -> str:
    return _DISPLAY_NAMES.get(provider, provider.title())


# Fallback order used until the user picks one in Settings, and the
# authoritative list of valid provider names for validation.
DEFAULT_PROVIDER_ORDER: list[str] = ["gemini", "groq", "ollama"]
PROVIDER_NAMES: list[str] = list(DEFAULT_PROVIDER_ORDER)


def normalize_provider_order(order) -> list[str]:
    """De-dupe, drop unknown names, and append any missing known provider at
    the end so the fallback chain never silently loses a provider just
    because an older/partial value is stored in Settings."""
    seen: list[str] = []
    if isinstance(order, list):
        for name in order:
            if name in _REGISTRY and name not in seen:
                seen.append(name)
    for name in DEFAULT_PROVIDER_ORDER:
        if name not in seen:
            seen.append(name)
    return seen


def normalize_provider_enabled(enabled) -> dict[str, bool]:
    """Every known provider defaults to enabled unless explicitly turned off."""
    result = {name: True for name in PROVIDER_NAMES}
    if isinstance(enabled, dict):
        for name, value in enabled.items():
            if name in result:
                result[name] = bool(value)
    return result


# ── Provider manager ───────────────────────────────────────────────────────────

class ProviderManager:
    """
    Singleton that owns provider selection and failover logic.

    Priority order and enabled/disabled state are re-read on every call, so
    changing either in Settings takes effect immediately — but a rate-limit-
    driven failover mid-session stays "sticky" on the provider it moved to
    (not reset every call) as long as neither has actually changed.
    """

    def __init__(self) -> None:
        # Reentrant: call() holds this for its whole retry loop and calls
        # describe_active() (which also acquires it) from inside that loop
        # when announcing a provider switch — a plain Lock would deadlock.
        self._lock = threading.RLock()
        self._cooldown_until: dict[str, float] = {}
        self._last_order = self._read_order()
        self._last_enabled = self._read_enabled()
        self._active_name = self._first_eligible(self._last_order, self._last_enabled)
        self._save_state()
        # Human-readable reason for the most recent call() that returned None
        # — callers that need to explain a failure (e.g. verify_offer's job
        # log) read this via last_error() right after call() returns None.
        self._last_error: Optional[str] = None
        # Structured version of the same thing (status/failure_reason/error_code/
        # provider/key_identifier/attempt_count) — see ai/_llm.get_last_llm_failure_info().
        self._last_failure_info: Optional[dict] = None
        logger.info("ProviderManager: initialised — active provider: %s", self.active_name)

    def last_error(self) -> Optional[str]:
        return self._last_error

    def last_failure_info(self) -> Optional[dict]:
        return self._last_failure_info

    # ── Settings-driven priority order & enabled state ──────────────────────────

    def _read_order(self) -> list[str]:
        from services import settings_service

        return normalize_provider_order(settings_service.get_setting("provider_order"))

    def _read_enabled(self) -> dict[str, bool]:
        from services import settings_service

        return normalize_provider_enabled(settings_service.get_setting("provider_enabled"))

    def _in_cooldown(self, name: str) -> bool:
        return time.monotonic() < self._cooldown_until.get(name, 0.0)

    def _first_eligible(self, order: list[str], enabled: dict[str, bool]) -> str:
        for name in order:
            if enabled.get(name, True) and not self._in_cooldown(name):
                return name
        # everything disabled/cooling down — still resolve to *something*
        # (the top of the order) so `current`/`active_name` never crash.
        return order[0]

    def _sync_order(self) -> tuple[list[str], dict[str, bool]]:
        """Re-read configured order/enabled state; if either changed since
        last time (the user re-prioritized, enabled, or disabled a provider
        in Settings), snap the active provider to the new top eligible
        choice immediately."""
        order = self._read_order()
        enabled = self._read_enabled()
        if order != self._last_order or enabled != self._last_enabled:
            self._last_order = order
            self._last_enabled = enabled
            self._active_name = self._first_eligible(order, enabled)
            self._save_state()
            logger.info("ProviderManager: priority/enabled changed via Settings — active provider now %s", self._active_name)
        return order, enabled

    # ── Health (read by the Settings API) ────────────────────────────────────

    def health(self) -> dict[str, dict]:
        with self._lock:
            order, enabled = self._sync_order()
            now = time.monotonic()
            result = {}
            for name in order:
                cooldown_until = self._cooldown_until.get(name)
                cooling_down = cooldown_until is not None and now < cooldown_until
                result[name] = {
                    "enabled": enabled.get(name, True),
                    "healthy": enabled.get(name, True) and not cooling_down,
                    "cooldown_seconds_remaining": round(cooldown_until - now, 1) if cooling_down else None,
                }
            return result

    def key_health(self, provider: str) -> list[dict]:
        """Per-key {"key_identifier", "status", "available", "retry_after_seconds",
        "last_reason"} for one provider — read for display in Settings (see
        module docstring's "Add clear provider state")."""
        from services import settings_service

        keys = settings_service.get_active_api_keys(provider)
        return _key_cooldowns.state_for(provider, keys)

    # ── State persistence ──────────────────────────────────────────────────────

    def _save_state(self) -> None:
        try:
            _STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            _STATE_FILE.write_text(
                json.dumps({"current_provider": self._active_name, "order": self._last_order}, indent=2),
                encoding="utf-8",
            )
        except Exception as exc:
            logger.warning("ProviderManager: state save failed — %s", exc)

    # ── Provider access ────────────────────────────────────────────────────────

    @property
    def current(self) -> Provider:
        return _REGISTRY[self._active_name]

    @property
    def active_name(self) -> str:
        return self._active_name

    def sync_active(self) -> str:
        """Force a fresh read of the configured priority/enabled state and
        return the (possibly just-updated) active provider name. Safe to
        call any time — e.g. from a Settings status endpoint — independent
        of an in-flight call() on another thread."""
        with self._lock:
            self._sync_order()
            return self._active_name

    def describe_active(self) -> dict:
        """{"provider": "Gemini", "key_identifier": "Gemini Key 1"} for
        whichever provider/key would be tried *right now* — a read-only peek,
        makes no network call. Used by job pipelines to announce "Provider: X
        / Key: Y" before analysing an item, since the actual call() may
        switch mid-flight and that's reported separately via on_event."""
        from services import settings_service

        with self._lock:
            self._sync_order()
            name = self._active_name
        provider = _REGISTRY[name]
        key_identifier = None
        if provider.uses_stored_keys:
            keys = [k for k in settings_service.get_active_api_keys(name) if not _key_cooldowns.is_cooling(name, k)]
            if keys:
                key_identifier = keys[0]["name"]
        return {"provider": display_name(name), "key_identifier": key_identifier}

    def _advance(self) -> bool:
        """Put the current provider on cooldown (every eligible key of its
        just failed, or none were eligible) and move to the next ELIGIBLE
        provider — enabled and not already cooling down — in priority order.
        Returns True if one was found, False if every remaining provider is
        disabled/cooling down."""
        order, enabled = self._sync_order()
        self._cooldown_until[self._active_name] = time.monotonic() + _COOLDOWN_SECONDS
        try:
            start_idx = order.index(self._active_name)
        except ValueError:
            start_idx = -1
        for idx in range(start_idx + 1, len(order)):
            name = order[idx]
            if enabled.get(name, True) and not self._in_cooldown(name):
                self._active_name = name
                self._save_state()
                logger.warning("ProviderManager: switched to %s (provider %d/%d)", name, idx + 1, len(order))
                return True
        return False

    # ── Main entry point ───────────────────────────────────────────────────────

    def call(self, prompt: str, on_event: OnEvent = None) -> Optional[str]:
        """
        Send prompt to the active provider — trying every eligible key first
        (see _call_with_key_rotation). Only after a provider's keys are all
        exhausted does this move to the next provider in priority order.
        Non-retryable errors return None without switching anything.

        `on_event` (optional) is called synchronously for every key/provider
        failure and switch, in the shapes documented in the module docstring
        — job pipelines use this to log real-time fallback visibility.
        """
        with self._lock:
            order, enabled = self._sync_order()

            if not enabled.get(self._active_name, True) or self._in_cooldown(self._active_name):
                self._active_name = self._first_eligible(order, enabled)

            if not any(enabled.get(n, True) and not self._in_cooldown(n) for n in order):
                self._last_error = "All AI providers are disabled or cooling down (rate-limited recently)."
                self._last_failure_info = {
                    "status": "failed", "failure_reason": "All API providers and keys exhausted",
                    "error_code": "exhausted", "provider": None, "key_identifier": None, "attempt_count": 0,
                }
                logger.error(self._last_error)
                return None

            total_attempts = 0
            while True:
                provider = self.current
                try:
                    result = provider.call(prompt, on_event=on_event)
                    logger.info("LLM used: %s", provider.name)
                    self._last_error = None
                    self._last_failure_info = None
                    return result

                except _AllKeysExhausted as exc:
                    total_attempts += max(exc.attempts, 1)
                    logger.warning("%s", exc)
                    _emit(on_event, {
                        "type": "provider_failed", "provider": provider.name,
                        "reason": exc.reason, "code": exc.code,
                    })
                    if self._advance():
                        new_provider = self.current
                        new_key = None
                        if new_provider.uses_stored_keys:
                            new_key = self.describe_active()["key_identifier"]
                        _emit(on_event, {
                            "type": "provider_switch", "from_provider": provider.name,
                            "to_provider": new_provider.name, "key": new_key,
                        })
                        logger.info("Retrying with %s …", self.current.name)
                        continue
                    self._last_error = f"All AI providers exhausted — last error: {exc}"
                    self._last_failure_info = {
                        "status": "failed", "failure_reason": "All API providers and keys exhausted",
                        "error_code": "exhausted", "provider": display_name(provider.name),
                        "key_identifier": exc.key_identifier, "attempt_count": total_attempts,
                    }
                    logger.error("All AI providers exhausted — giving up.")
                    return None

                except Exception as exc:
                    total_attempts += 1
                    info = classify_error(exc)

                    if info.retryable:
                        # A uses_stored_keys=False provider (e.g. Ollama) failed directly —
                        # there's no per-key rotation for it, so this is provider-level.
                        logger.warning("%s on %s — %s", info.reason, provider.name, exc)
                        _emit(on_event, {"type": "provider_failed", "provider": provider.name, "reason": info.reason, "code": info.code})
                        if self._advance():
                            new_provider = self.current
                            new_key = self.describe_active()["key_identifier"] if new_provider.uses_stored_keys else None
                            _emit(on_event, {
                                "type": "provider_switch", "from_provider": provider.name,
                                "to_provider": new_provider.name, "key": new_key,
                            })
                            logger.info("Retrying with %s …", self.current.name)
                            continue
                        self._last_error = f"All AI providers exhausted — last error on {provider.name}: {exc}"
                        self._last_failure_info = {
                            "status": "failed", "failure_reason": "All API providers and keys exhausted",
                            "error_code": "exhausted", "provider": display_name(provider.name),
                            "key_identifier": None, "attempt_count": total_attempts,
                        }
                        logger.error("All AI providers exhausted — giving up.")
                        return None

                    # Non-retryable: malformed request, unparseable response upstream, etc.
                    self._last_error = f"{provider.name} error: {exc}"
                    self._last_failure_info = {
                        "status": "failed", "failure_reason": info.reason, "error_code": info.code,
                        "provider": display_name(provider.name), "key_identifier": None, "attempt_count": total_attempts,
                    }
                    logger.error("Non-retryable error on %s: %s", provider.name, exc)
                    return None
