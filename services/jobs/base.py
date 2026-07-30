"""The BackgroundJob interface every pipeline action implements.

Critical vs. recoverable errors
--------------------------------
`process_item` returns "successful" | "failed" | "skipped" for expected,
per-item outcomes — the run keeps going. It should *raise* (ideally
`CriticalError`, but any uncaught exception is treated the same way) only for
conditions that make continuing the whole job pointless:

  Critical (fail-fast, stop the job immediately):
    - Gmail / AI-provider authentication failure
    - missing required API key or env var
    - database unavailable or a write failure
    - invalid configuration
    - worker crash
    - services.retry.retry_with_backoff exhausting its attempts
    - any other unhandled exception (safe default)

  Recoverable (catch inside process_item, return "failed", keep going):
    - one email that fails to parse / has invalid HTML
    - AI analysis failing for a single item
    - a duplicate offer
    - one brand's fetch/research failing
    - one attachment invalid
    - one record failing validation

Adding a new pipeline action = subclass BackgroundJob, register an instance
in services/job_registry.py, add one entry to frontend/src/config/jobTypes.ts.
No changes to job_runner.py, api/jobs.py, or the frontend job plumbing.
"""
from dataclasses import dataclass
from typing import Any


class CriticalError(Exception):
    """Raise deliberately from process_item for an unrecoverable, fail-fast condition."""


@dataclass
class WorkItem:
    id: Any
    label: str


class BackgroundJob:
    job_type: str = ""
    concurrent: bool = False  # True only for EmailSyncJob (keeps its thread-pool model)

    def collect_work(self, job: dict) -> list[WorkItem]:
        raise NotImplementedError

    def process_item(self, job_id: int, item: WorkItem) -> str:
        """Return "successful" | "failed" | "skipped". Raise CriticalError (or
        let any exception propagate) to stop the job immediately."""
        raise NotImplementedError

    def before_run(self, job_id: int, job: dict) -> None:
        pass

    def after_run(self, job_id: int, job: dict) -> None:
        pass

    def on_success(self, job_id: int) -> None:
        pass

    def on_failure(self, job_id: int, error: Exception) -> None:
        pass

    def on_cancel(self, job_id: int) -> None:
        pass

    def run(self, job_id: int, payload: dict) -> None:
        """Default sequential, one-item-at-a-time, fail-fast runner. EmailSyncJob
        overrides this completely for its concurrent thread-pool model."""
        from services.job_runner import run_sequential_job

        run_sequential_job(job_id, self, payload)
