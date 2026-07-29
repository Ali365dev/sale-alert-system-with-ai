"""
AI provider abstraction with persistent session-level failover.

Startup behaviour:  always resets to Gemini (index 0).
On rate-limit:      advances to next provider, saves state, retries the request.
On other errors:    returns None — does NOT switch providers.
Thread-safe:        a single lock guards provider selection and the retry loop.

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

# ── Rate-limit detection ───────────────────────────────────────────────────────

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


def _is_rate_limit(exc: Exception) -> bool:
    if type(exc).__name__ in _RATE_LIMIT_EXC_NAMES:
        return True
    text = str(exc).lower()
    return any(phrase in text for phrase in _RATE_LIMIT_PHRASES)


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

    def __init__(self) -> None:
        from google import genai
        self._model = GEMINI_MODEL
        self._client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

    def call(self, prompt: str) -> str:
        if not self._client:
            raise RuntimeError("Gemini not configured — GEMINI_API_KEY missing")
        from google.genai import types
        response = self._client.models.generate_content(
            model=self._model,
            contents=prompt,
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        return response.text


class GroqProvider(Provider):
    name = "groq"

    def __init__(self) -> None:
        from groq import Groq
        self._model = GROQ_MODEL
        self._client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

    def call(self, prompt: str) -> str:
        if not self._client:
            raise RuntimeError("Groq not configured — GROQ_API_KEY missing")
        last_exc: Exception = RuntimeError("no attempts made")
        for attempt in range(1, _TRANSIENT_RETRIES + 1):
            try:
                completion = self._client.chat.completions.create(
                    model=self._model,
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.2,
                )
                return completion.choices[0].message.content
            except Exception as exc:
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

    def __init__(self) -> None:
        import requests as _req
        self._requests = _req
        self._url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/generate"
        self._model = OLLAMA_MODEL

    def call(self, prompt: str) -> str:
        payload = {
            "model": self._model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.2},
        }
        last_exc: Exception = RuntimeError("no attempts made")
        for attempt in range(1, _TRANSIENT_RETRIES + 1):
            try:
                resp = self._requests.post(self._url, json=payload, timeout=120)
                resp.raise_for_status()
                return resp.json().get("response", "")
            except self._requests.exceptions.HTTPError as exc:
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
