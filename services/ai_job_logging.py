"""Shared job-log translation for AI provider/key fallback visibility.

ai/providers.py knows nothing about jobs, subjects, or job_ids — it only
emits a stream of structured events (see its module docstring) to whatever
on_event callback a caller passes to call_llm()/analyze_email(). This module
is that translation layer: it turns those events into the real-time
"switching provider/key" job-log lines, shared by every job that runs
AI analysis (services/email_sync.py, services/jobs/process_pending.py) so
the wording/format can't drift between them.
"""
from typing import Callable, Optional

from ai.providers import display_name as _provider_display, short_reason
from services import job_service

_DEFAULT_FAILURE_INFO = {
    "status": "failed", "failure_reason": "Unknown API error", "error_code": "unknown",
    "provider": None, "key_identifier": None, "attempt_count": 1,
}


def failure_info_or_default(failure_info: Optional[dict]) -> dict:
    return failure_info or dict(_DEFAULT_FAILURE_INFO)


def provider_key_lines(info: dict) -> str:
    """"Provider: Gemini" (+ "\\nKey: Gemini Key 1" when there is a stored
    key, e.g. not Ollama/env-fallback) — the two-line block appended to the
    pipeline-start / per-email-start / retry job-log entries."""
    lines = [f"Provider: {info['provider']}"]
    if info.get("key_identifier"):
        lines.append(f"Key: {info['key_identifier']}")
    return "\n".join(lines)


def make_provider_event_logger(job_id: int, item_label: str) -> Callable[[dict], None]:
    """Turns ai/providers.py's on_event stream into real-time job-log lines
    — pass the result as analyze_email(..., on_event=...). Stateless; safe
    to build fresh per item."""

    def on_event(event: dict) -> None:
        etype = event["type"]

        if etype == "key_failed":
            job_service.append_log(
                job_id, f"⚠ {event['key']} {short_reason(event['reason'])}", severity="warning", category="ai",
            )
        elif etype == "key_switch":
            job_service.append_log(job_id, f"→ Switching to {event['to_key']}", category="ai")
            job_service.append_log(
                job_id,
                f"→ Retrying \"{item_label[:60]}\"\nProvider: {_provider_display(event['provider'])}\nKey: {event['to_key']}",
                category="ai",
            )
        elif etype == "provider_failed":
            job_service.append_log(
                job_id, f"⚠ {_provider_display(event['provider'])} {short_reason(event['reason'])}",
                severity="warning", category="ai",
            )
        elif etype == "provider_switch":
            from_name, to_name = _provider_display(event["from_provider"]), _provider_display(event["to_provider"])
            job_service.append_log(job_id, f"→ Switching from {from_name} to {to_name}", category="ai")
            switched = f"→ Switched to {to_name}"
            if event.get("key"):
                switched += f"\nKey: {event['key']}"
            job_service.append_log(job_id, switched, category="ai")
            retry = f"→ Retrying \"{item_label[:60]}\"\nProvider: {to_name}"
            if event.get("key"):
                retry += f"\nKey: {event['key']}"
            job_service.append_log(job_id, retry, category="ai")

    return on_event
