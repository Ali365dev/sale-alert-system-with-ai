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
from typing import Optional

from ai.providers import ProviderManager

# One instance per process — __init__ starts at the configured priority order's
# first eligible provider.
_manager = ProviderManager()


def call_llm(prompt: str, retries: int = 3) -> Optional[str]:
    """
    Send prompt to the currently active AI provider.
    Automatically fails over to the next provider on rate-limit errors.
    Returns the response text or None if all providers fail.

    `retries` is accepted for backward compatibility but ignored — each
    provider handles its own transient-error retries internally.
    """
    return _manager.call(prompt)


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
