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
    key first, then every other enabled/non-invalid key for that SAME
    provider, in priority order, before ever giving up on that provider.
    Changing a provider's active key never touches provider order, and
    reordering providers never touches any provider's active key — see
    services/settings_service.py's `reorder_api_keys` for the key-side half
    of this and api/settings.py's /providers endpoints for the provider-side
    half.

Failover trigger (both levels): quota / rate-limit / auth / timeout errors.
Any other error is treated as non-retryable — it's surfaced immediately and
does NOT burn through remaining keys or advance to the next provider (a
malformed prompt fails the same way on every provider/key).

Provider health/cooldown: once every key for a provider has been tried and
failed, that provider is put on cooldown (skipped by future calls) for
_COOLDOWN_SECONDS, then eligible again. Purely in-memory/per-process — a
restart clears it.

Adding a new provider:
    1. Subclass Provider, set `name` and `uses_stored_keys`.
    2. If uses_stored_keys: implement `_model()` and `_call_one(prompt, raw_key, model)`.
       If not (e.g. a local model): implement `call(prompt)` directly.
    3. Register an instance in _REGISTRY and its name in DEFAULT_PROVIDER_ORDER.
    No other changes needed — Settings UI and failover pick it up automatically.
"""
import json
import threading
import time
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional

from config import (
    GEMINI_API_KEY, GEMINI_MODEL,
    GROQ_API_KEY,   GROQ_MODEL,
    OLLAMA_BASE_URL, OLLAMA_MODEL,
    BRAND_RETRY_COUNT,
    logger,
)

_STATE_FILE = Path(__file__).parent.parent / "cache" / "provider_state.json"
_TRANSIENT_RETRIES = BRAND_RETRY_COUNT  # retries within a single key for non-rotatable transient errors
_COOLDOWN_SECONDS = 300  # how long a fully-exhausted provider is skipped before being retried again

# ── Rotatable-failure detection (shared by key rotation AND provider failover) ──

_RATE_LIMIT_EXC_NAMES = frozenset({
    "RateLimitError",
    "ResourceExhausted",
    "TooManyRequestsError",
    "QuotaExceeded",
})

_RATE_LIMIT_PHRASES = (
    "429",
    "rate limit",
    "quota exceeded",
    "resource exhausted",
    "resource_exhausted",
    "too many requests",
    "ratelimitexceeded",
)


def is_rate_limit_message(text: str | None) -> bool:
    """Phrase-only check, for plain error strings (e.g. ApiKey.last_error)
    where no exception object/type is available."""
    if not text:
        return False
    text = text.lower()
    return any(phrase in text for phrase in _RATE_LIMIT_PHRASES)


def _is_rate_limit(exc: Exception) -> bool:
    if type(exc).__name__ in _RATE_LIMIT_EXC_NAMES:
        return True
    return is_rate_limit_message(str(exc))


_AUTH_EXC_NAMES = frozenset({
    "PermissionDenied", "Unauthenticated", "AuthenticationError", "PermissionDeniedError",
})
_AUTH_PHRASES = ("api key not valid", "invalid api key", "permission denied", "unauthenticated", "401", "403")

_TIMEOUT_EXC_NAMES = frozenset({"Timeout", "DeadlineExceeded", "ReadTimeout", "ConnectTimeout"})
_TIMEOUT_PHRASES = ("timeout", "timed out", "deadline exceeded")


def _is_auth_failure(exc: Exception) -> bool:
    if type(exc).__name__ in _AUTH_EXC_NAMES:
        return True
    text = str(exc).lower()
    return any(phrase in text for phrase in _AUTH_PHRASES)


def _is_timeout(exc: Exception) -> bool:
    if type(exc).__name__ in _TIMEOUT_EXC_NAMES:
        return True
    text = str(exc).lower()
    return any(phrase in text for phrase in _TIMEOUT_PHRASES)


def _is_key_rotatable(exc: Exception) -> bool:
    """Whether a single-key failure should move on to the next key for the
    same provider rather than propagating immediately — quota/rate-limit/
    auth/timeout, everything the Settings spec calls out for automatic
    key rotation."""
    return _is_rate_limit(exc) or _is_auth_failure(exc) or _is_timeout(exc)


class _AllKeysExhausted(Exception):
    """Raised once every stored key for a provider has been tried and
    failed (or none are configured). ProviderManager catches this
    specifically to always advance to the next provider — regardless of
    which exact rotatable reason the *last* key happened to fail with."""


# ── Provider base class ────────────────────────────────────────────────────────

class Provider(ABC):
    name: str
    uses_stored_keys: bool = False  # True: backed by database.models.ApiKey rows (rotated automatically)

    @abstractmethod
    def call(self, prompt: str) -> str:
        """
        Send prompt and return the response text.
        Rotatable errors (quota/rate-limit/auth/timeout) are propagated as
        _AllKeysExhausted once every key/attempt is spent; other errors
        propagate as-is and must NOT trigger key rotation or provider failover.
        """


# ── Shared key-rotation loop — used by every uses_stored_keys provider ──────────

def _call_with_key_rotation(provider: "Provider", prompt: str, env_fallback_key: str | None) -> str:
    """Try `provider`'s current active key (Settings > that provider's key
    list, priority 0), then every other enabled/non-invalid key for the same
    provider in priority order. Only after all are exhausted does this raise
    _AllKeysExhausted, signalling ProviderManager to move to the next
    provider in priority order."""
    from services import settings_service

    keys = settings_service.get_active_api_keys(provider.name)
    if not keys and env_fallback_key:
        # No keys added in Settings yet — fall back to .env so existing
        # deployments keep working unchanged until someone migrates.
        keys = [{"id": None, "name": "env (.env fallback)", "decrypted_key": env_fallback_key}]
    if not keys:
        raise _AllKeysExhausted(f"{provider.name} not configured — no active key and no .env fallback")

    model = provider._model()  # type: ignore[attr-defined]
    last_exc: Exception = RuntimeError(f"no {provider.name} keys attempted")
    for key_info in keys:
        try:
            result = provider._call_one(prompt, key_info["decrypted_key"], model)  # type: ignore[attr-defined]
            if key_info["id"] is not None:
                settings_service.record_key_usage(key_info["id"])
            return result
        except Exception as exc:
            last_exc = exc
            if key_info["id"] is not None:
                settings_service.record_key_failure(key_info["id"], str(exc), mark_invalid=_is_auth_failure(exc))
            if _is_key_rotatable(exc):
                logger.warning(
                    "%s key %r failed (%s) — trying next key", provider.name, key_info["name"], type(exc).__name__,
                )
                continue
            raise  # non-rotatable (e.g. malformed request) — don't burn through every key for it
    raise _AllKeysExhausted(f"All {provider.name} keys exhausted — last error: {last_exc}") from last_exc


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

    def call(self, prompt: str) -> str:
        return _call_with_key_rotation(self, prompt, GEMINI_API_KEY)


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
                # Groq raises AuthenticationError, BadRequestError etc. for 4xx —
                # these (and rate-limits) are not transient, retrying won't help;
                # let the caller decide whether to rotate to the next key.
                exc_name = type(exc).__name__
                if any(n in exc_name for n in ("AuthenticationError", "BadRequestError", "NotFoundError", "PermissionDeniedError")):
                    raise
                if _is_rate_limit(exc):
                    raise
                last_exc = exc
                logger.warning("Groq transient error (attempt %d/%d): %s", attempt, _TRANSIENT_RETRIES, exc)
                if attempt < _TRANSIENT_RETRIES:
                    time.sleep(2 ** attempt)
        raise last_exc

    def call(self, prompt: str) -> str:
        return _call_with_key_rotation(self, prompt, GROQ_API_KEY)


class OllamaProvider(Provider):
    name = "ollama"
    uses_stored_keys = False  # local model — no stored key to rotate

    def call(self, prompt: str) -> str:
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
            except _req.exceptions.HTTPError as exc:
                if _is_rate_limit(exc):
                    raise
                # 4xx client errors (404 model not found, 400 bad request, etc.)
                # are not transient — retrying will not help.
                if exc.response is not None and 400 <= exc.response.status_code < 500:
                    logger.error("Ollama client error (not retrying): %s", exc)
                    raise
                last_exc = exc
                logger.warning("Ollama transient error (attempt %d/%d): %s", attempt, _TRANSIENT_RETRIES, exc)
                if attempt < _TRANSIENT_RETRIES:
                    time.sleep(2 ** attempt)
            except Exception as exc:
                if _is_rate_limit(exc):
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
        self._lock = threading.Lock()
        self._cooldown_until: dict[str, float] = {}
        self._last_order = self._read_order()
        self._last_enabled = self._read_enabled()
        self._active_name = self._first_eligible(self._last_order, self._last_enabled)
        self._save_state()
        # Human-readable reason for the most recent call() that returned None
        # — callers that need to explain a failure (e.g. verify_offer's job
        # log) read this via last_error() right after call() returns None.
        self._last_error: Optional[str] = None
        logger.info("ProviderManager: initialised — active provider: %s", self.active_name)

    def last_error(self) -> Optional[str]:
        return self._last_error

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

    def _advance(self) -> bool:
        """Put the current provider on cooldown (every one of its keys just
        failed) and move to the next ELIGIBLE provider — enabled and not
        already cooling down — in priority order. Returns True if one was
        found, False if every remaining provider is disabled/cooling down."""
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

    def call(self, prompt: str) -> Optional[str]:
        """
        Send prompt to the active provider — trying every one of its keys
        first (see _call_with_key_rotation). Only after a provider's keys
        are all exhausted does this move to the next provider in priority
        order. Non-retryable errors return None without switching anything.
        """
        with self._lock:
            order, enabled = self._sync_order()

            if not enabled.get(self._active_name, True) or self._in_cooldown(self._active_name):
                self._active_name = self._first_eligible(order, enabled)

            if not any(enabled.get(n, True) and not self._in_cooldown(n) for n in order):
                self._last_error = "All AI providers are disabled or cooling down (rate-limited recently)."
                logger.error(self._last_error)
                return None

            while True:
                provider = self.current
                try:
                    result = provider.call(prompt)
                    logger.info("LLM used: %s", provider.name)
                    self._last_error = None
                    return result

                except _AllKeysExhausted as exc:
                    logger.warning("%s", exc)
                    if self._advance():
                        logger.info("Retrying with %s …", self.current.name)
                        continue
                    self._last_error = f"All AI providers exhausted — last error: {exc}"
                    logger.error("All AI providers exhausted — giving up.")
                    return None

                except Exception as exc:
                    if _is_rate_limit(exc):
                        # a uses_stored_keys=False provider (e.g. Ollama) rate-limited directly
                        logger.warning("Rate limit on %s — %s", provider.name, exc)
                        if self._advance():
                            logger.info("Retrying with %s …", self.current.name)
                            continue
                        self._last_error = f"All AI providers rate-limited — last error on {provider.name}: {exc}"
                        logger.error("All AI providers exhausted — giving up.")
                        return None

                    # Non-retryable: auth failure, malformed request, etc.
                    self._last_error = f"{provider.name} error: {exc}"
                    logger.error("Non-retryable error on %s: %s", provider.name, exc)
                    return None
