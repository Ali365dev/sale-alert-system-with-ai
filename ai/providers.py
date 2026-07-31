"""
AI provider abstraction with persistent session-level failover.

Startup behaviour:  always resets to Gemini (index 0).
On rate-limit:      advances to next provider, saves state, retries the request.
On other errors:    returns None — does NOT switch providers.
Thread-safe:        a single lock guards provider selection and the retry loop.

Gemini specifically supports multiple stored API keys (services/settings_service.py
-> database.models.ApiKey), rotating between them — on quota/rate-limit/auth/
timeout failures — before this outer provider-level failover to Groq ever
kicks in. Groq/Ollama read their (single) key fresh from Settings on every
call too, falling back to the .env value if nothing's been set in Settings
yet, so existing .env-only setups keep working unchanged.

Adding a new provider:
    1. Subclass Provider and implement call().
    2. Append an instance to ProviderManager.PROVIDERS.
    No other changes needed.
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
_TRANSIENT_RETRIES = BRAND_RETRY_COUNT  # retries within a provider for non-rate-limit errors

# ── Rate-limit detection (provider-level failover; unchanged from before) ──────

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


# ── Gemini-key-level failure detection (broader — also rotates on auth/timeout) ─

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


def _is_gemini_key_rotatable(exc: Exception) -> bool:
    """Whether a Gemini key failure should move on to the next stored key
    rather than propagating (quota/rate-limit/auth/timeout — everything the
    Settings spec calls out for automatic rotation)."""
    return _is_rate_limit(exc) or _is_auth_failure(exc) or _is_timeout(exc)


# ── Provider base class ────────────────────────────────────────────────────────

class Provider(ABC):
    name: str

    @abstractmethod
    def call(self, prompt: str) -> str:
        """
        Send prompt and return the response text.
        Raises on failure — rate-limit errors are propagated immediately;
        transient errors may be retried internally before raising.
        """


# ── Concrete providers ─────────────────────────────────────────────────────────

class GeminiProvider(Provider):
    name = "gemini"

    def _candidate_keys(self) -> list[dict]:
        from services import settings_service

        keys = settings_service.get_active_api_keys("gemini")
        if not keys and GEMINI_API_KEY:
            # No keys added in Settings yet — fall back to .env so existing
            # deployments keep working unchanged until someone migrates.
            keys = [{"id": None, "name": "env (.env fallback)", "decrypted_key": GEMINI_API_KEY}]
        return keys

    def call(self, prompt: str) -> str:
        from services import settings_service

        keys = self._candidate_keys()
        if not keys:
            raise RuntimeError("Gemini not configured — add a key in Settings or set GEMINI_API_KEY")

        model = settings_service.get_setting("gemini_model", default=GEMINI_MODEL)

        last_exc: Exception = RuntimeError("no Gemini keys attempted")
        for key_info in keys:
            try:
                from google import genai
                from google.genai import types
                client = genai.Client(api_key=key_info["decrypted_key"])
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config=types.GenerateContentConfig(response_mime_type="application/json"),
                )
                if key_info["id"] is not None:
                    settings_service.record_key_usage(key_info["id"])
                return response.text
            except Exception as exc:
                last_exc = exc
                if key_info["id"] is not None:
                    settings_service.record_key_failure(
                        key_info["id"], str(exc), mark_invalid=_is_auth_failure(exc),
                    )
                if _is_gemini_key_rotatable(exc):
                    logger.warning(
                        "Gemini key %r failed (%s) — trying next key", key_info["name"], type(exc).__name__,
                    )
                    continue
                raise  # non-rotatable error (e.g. malformed request) — don't burn through every key for it
        raise last_exc


class GroqProvider(Provider):
    name = "groq"

    def _key_info_and_model(self) -> tuple[Optional[dict], str]:
        from services import settings_service

        keys = settings_service.get_active_api_keys("groq")
        key_info = keys[0] if keys else ({"id": None, "decrypted_key": GROQ_API_KEY} if GROQ_API_KEY else None)
        model = settings_service.get_setting("groq_model", default=GROQ_MODEL)
        return key_info, model

    def call(self, prompt: str) -> str:
        key_info, model = self._key_info_and_model()
        if not key_info or not key_info.get("decrypted_key"):
            raise RuntimeError("Groq not configured — add a key in Settings or set GROQ_API_KEY")
        from services import settings_service
        from groq import Groq
        client = Groq(api_key=key_info["decrypted_key"])

        last_exc: Exception = RuntimeError("no attempts made")
        for attempt in range(1, _TRANSIENT_RETRIES + 1):
            try:
                completion = client.chat.completions.create(
                    model=model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                )
                if key_info["id"] is not None:
                    settings_service.record_key_usage(key_info["id"])
                return completion.choices[0].message.content
            except Exception as exc:
                if key_info["id"] is not None:
                    settings_service.record_key_failure(key_info["id"], str(exc), mark_invalid=_is_auth_failure(exc))
                if _is_rate_limit(exc):
                    raise  # propagate immediately — manager handles failover
                # Groq raises AuthenticationError, BadRequestError etc. for 4xx —
                # these are not transient, retrying will not help.
                exc_name = type(exc).__name__
                if any(n in exc_name for n in ("AuthenticationError", "BadRequestError", "NotFoundError", "PermissionDeniedError")):
                    logger.error("Groq non-retryable error: %s", exc)
                    raise
                last_exc = exc
                logger.warning("Groq transient error (attempt %d/%d): %s", attempt, _TRANSIENT_RETRIES, exc)
                if attempt < _TRANSIENT_RETRIES:
                    time.sleep(2 ** attempt)
        raise last_exc


class OllamaProvider(Provider):
    name = "ollama"

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


# ── Provider manager ───────────────────────────────────────────────────────────

class ProviderManager:
    """
    Singleton that owns provider selection and failover logic.

    Instantiate once at module level — __init__ resets to Gemini,
    satisfying the "always start from Gemini on app startup" requirement.
    """

    # Ordered list of providers — add new providers here, nowhere else.
    PROVIDERS: list[Provider] = [
        GeminiProvider(),
        GroqProvider(),
        OllamaProvider(),
    ]

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._index = 0          # always start at Gemini
        self._save_state()
        logger.info("ProviderManager: initialised — active provider: %s", self.current.name)

    # ── State persistence ──────────────────────────────────────────────────────

    def _save_state(self) -> None:
        try:
            _STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            _STATE_FILE.write_text(
                json.dumps({"current_provider": self.current.name}, indent=2),
                encoding="utf-8",
            )
        except Exception as exc:
            logger.warning("ProviderManager: state save failed — %s", exc)

    # ── Provider access ────────────────────────────────────────────────────────

    @property
    def current(self) -> Provider:
        return self.PROVIDERS[self._index]

    @property
    def active_name(self) -> str:
        return self.current.name

    def _advance(self) -> bool:
        """
        Move to next provider and persist state.
        Returns True if a new provider is available, False if already at last.
        """
        if self._index >= len(self.PROVIDERS) - 1:
            return False
        self._index += 1
        self._save_state()
        logger.warning(
            "ProviderManager: switched to %s (provider %d/%d)",
            self.current.name, self._index + 1, len(self.PROVIDERS),
        )
        return True

    # ── Main entry point ───────────────────────────────────────────────────────

    def call(self, prompt: str) -> Optional[str]:
        """
        Send prompt to the active provider.
        On rate-limit: switch to next provider and retry automatically.
        On other errors: return None without switching.
        """
        with self._lock:
            while True:
                provider = self.current
                try:
                    result = provider.call(prompt)
                    logger.info("LLM used: %s", provider.name)
                    return result

                except Exception as exc:
                    if _is_rate_limit(exc):
                        logger.warning(
                            "Rate limit on %s — %s", provider.name, exc
                        )
                        if self._advance():
                            logger.info("Retrying with %s …", self.current.name)
                            continue  # retry loop with new provider

                        logger.error(
                            "All %d AI providers exhausted — giving up.",
                            len(self.PROVIDERS),
                        )
                        return None

                    # Non-retryable: auth failure, malformed request, etc.
                    logger.error(
                        "Non-retryable error on %s: %s", provider.name, exc
                    )
                    return None
