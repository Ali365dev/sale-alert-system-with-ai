"""Registry + generic sequential executor for BackgroundJob subclasses.

api/jobs.py only ever needs `get_runner(job_type)` and `.run(job_id, payload)`
— it never needs to know whether a job type is concurrent or sequential.
"""
from services.jobs.base import BackgroundJob
from services import job_service

JOB_REGISTRY: dict[str, BackgroundJob] = {}


def register(job: BackgroundJob) -> None:
    JOB_REGISTRY[job.job_type] = job


def get_runner(job_type: str) -> BackgroundJob | None:
    return JOB_REGISTRY.get(job_type)


def run_sequential_job(job_id: int, job: BackgroundJob, payload: dict) -> None:
    """True fail-fast, one-item-at-a-time runner shared by every non-concurrent
    job type. A raised exception from process_item stops the job immediately;
    a returned "successful"/"failed"/"skipped" outcome just continues."""
    job_dict = job_service.get_job(job_id)
    try:
        job.before_run(job_id, job_dict)

        job_service.set_stage(job_id, "collecting_work")
        job_service.append_log(job_id, "Collecting work items…", category="system")
        items = job.collect_work(job_dict)

        job_service.mark_running(job_id, total_items=len(items))
        job_service.set_stage(job_id, "processing")

        if not items:
            job_service.set_stage(job_id, "completed")
            job_service.finish_job(job_id, "completed")
            job_service.append_log(job_id, "Nothing to do.", severity="success", category="system")
            job.on_success(job_id)
            return

        for item in items:
            if job_service.is_cancel_requested(job_id):
                job_service.append_log(job_id, "Cancelled by user.", severity="warning", category="system")
                job_service.finish_job(job_id, "cancelled")
                job.on_cancel(job_id)
                return

            try:
                outcome = job.process_item(job_id, item)
            except Exception as exc:
                # CriticalError or any other uncaught exception — both fail-fast (see base.py docstring)
                job_service.append_log(
                    job_id, f"✗ Fatal error on \"{item.label[:60]}\" — {exc}", severity="error", category="system",
                )
                job_service.update_progress(job_id, processed_delta=1, failed_delta=1, current_item_label=item.label)
                job_service.set_checkpoint(job_id, item.id, item.label)
                job_service.finish_job(job_id, "failed", error=str(exc))
                job.on_failure(job_id, exc)
                return

            delta_kwargs = {"processed_delta": 1, "current_item_label": item.label, f"{outcome}_delta": 1}
            job_service.update_progress(job_id, **delta_kwargs)
            job_service.set_checkpoint(job_id, item.id, item.label)

        job_service.set_stage(job_id, "finalizing")
        job.after_run(job_id, job_service.get_job(job_id))
        job_service.set_stage(job_id, "completed")
        job_service.finish_job(job_id, "completed")
        job_service.append_log(job_id, "Done.", severity="success", category="system")
        job.on_success(job_id)
    except Exception as exc:
        job_service.append_log(job_id, f"Error: {exc}", severity="error", category="system")
        job_service.finish_job(job_id, "failed", error=str(exc))
        job.on_failure(job_id, exc)
