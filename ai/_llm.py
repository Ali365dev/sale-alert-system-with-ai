"""
LLM entry point — delegates to ProviderManager.

The manager is created once per process (module-level singleton). Creating
it starts at the top of the configured priority order (Settings > API
Configuration, default Gemini first).

Failover order:   configurable — see ai/providers.py's provider_order Setting.
Failover trigger: quota / rate-limit / auth / timeout errors, after every
                  key for the current provider has been tried (see
                  ai/providers.py's _call_with_key_rotation).
"""
from typing import Callable, Optional

from ai.providers import ProviderManager

# One instance per process — __init__ starts at the configured priority order's
# first eligible provider.
_manager = ProviderManager()


def call_llm(prompt: str, retries: int = 3, on_event: Optional[Callable[[dict], None]] = None) -> Optional[str]:
    """
    Send prompt to the currently active AI provider.
    Automatically fails over to the next provider on rate-limit errors.
    Returns the response text or None if all providers fail.

    `retries` is accepted for backward compatibility but ignored — each
    provider handles its own transient-error retries internally.

    `on_event` (optional) is invoked synchronously for every key/provider
    failure and switch during this call — see ai/providers.py's module
    docstring for the event shapes. Job pipelines pass this to log
    real-time fallback visibility; callers that don't care can omit it.
    """
    return _manager.call(prompt, on_event=on_event)


def get_last_llm_error() -> Optional[str]:
    """Human-readable reason the most recent call_llm() returned None — read
    this right after a None result to explain the failure (e.g. in a job
    log), since call_llm() itself only returns the response text or None."""
    return _manager.last_error()


def get_last_llm_failure_info() -> Optional[dict]:
    """Structured version of get_last_llm_error(): {"status", "failure_reason",
    "error_code", "provider", "key_identifier", "attempt_count"} for the most
    recent call_llm() that returned None — read this right after a None
    result to retain structured failure info (e.g. on the Email row) rather
    than just a free-text message. None if the most recent call succeeded."""
    return _manager.last_failure_info()


def describe_active_provider() -> dict:
    """{"provider": "Gemini", "key_identifier": "Gemini Key 1"} for whichever
    provider/key call_llm() would try *right now* — a read-only peek, makes
    no network call. Job pipelines use this to announce "Provider: X / Key:
    Y" before analysing an item; a switch mid-call is reported separately via
    on_event, since describe_active_provider() can't see into the future."""
    return _manager.describe_active()


def get_active_provider() -> str:
    """The provider name (e.g. "gemini") currently in use by this process —
    read for display in Settings, never mutated directly (change it via the
    provider_order/provider_enabled Settings instead, which ProviderManager
    picks up live). Forces a fresh settings check, so a just-saved
    re-priority shows immediately even if no AI call has happened since."""
    return _manager.sync_active()


def get_provider_health() -> dict[str, dict]:
    """Per-provider {"enabled", "healthy", "cooldown_seconds_remaining"} —
    read for display in Settings."""
    return _manager.health()


def get_key_health(provider: str) -> list[dict]:
    """Per-key {"key_identifier", "status", "available", "retry_after_seconds",
    "last_reason"} for one provider — read for display in Settings."""
    return _manager.key_health(provider)
