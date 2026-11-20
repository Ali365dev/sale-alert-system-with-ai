"""Registry adapter for the existing concurrent email_sync pipeline.

Kept as a thin wrapper rather than folding into BackgroundJob's sequential
template method — email_sync deliberately keeps its ThreadPoolExecutor model
for speed (see plan: "keep concurrent for email sync"). collect_work/
process_item are left unimplemented since `run()` is fully overridden.
"""
from services.jobs.base import BackgroundJob


class EmailSyncJob(BackgroundJob):
    job_type = "email_sync"
    concurrent = True

    def run(self, job_id: int, payload: dict) -> None:
        from services.email_sync import run_email_sync_job

        worker_count = (payload or {}).get("workers", 5)
        try:
            worker_count = max(1, min(10, int(worker_count)))
        except (TypeError, ValueError):
            worker_count = 5
        run_email_sync_job(job_id, worker_count)
