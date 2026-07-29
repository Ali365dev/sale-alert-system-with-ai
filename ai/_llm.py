"""
LLM entry point — delegates to ProviderManager.

The manager is created once per process (module-level singleton).
Creating it resets the active provider to Gemini, so every app
restart automatically starts fresh from the highest-priority provider.

Failover order:  Gemini → Groq → Local Llama
Failover trigger: rate-limit / quota errors only.
"""
from typing import Optional

from ai.providers import ProviderManager

# One instance per process — __init__ resets active provider to Gemini.
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
