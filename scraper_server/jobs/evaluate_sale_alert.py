"""Evaluate one just-created sale alert (app_server triggers this over HTTP):
product alerts get an immediate price check, brand alerts scan recent offers."""
from services.jobs.base import BackgroundJob, WorkItem
from services.sale_alert_service import evaluate_alert_on_create


class EvaluateSaleAlertJob(BackgroundJob):
    job_type = "evaluate_sale_alert"

    def collect_work(self, job: dict) -> list[WorkItem]:
        alert_id = (job.get("payload") or {}).get("alert_id")
        return [WorkItem(id=int(alert_id), label=f"Sale alert #{alert_id}")] if alert_id else []

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from services import job_service

        result = evaluate_alert_on_create(int(item.id))
        if not result.get("ok"):
            job_service.append_log(
                job_id, f"{item.label}: {result.get('error') or 'failed'}",
                severity="warning", category="sale_alerts",
            )
            return "failed"
        job_service.append_log(
            job_id,
            f"{item.label}: {'TRIGGERED' if result.get('triggered') else 'checked'}",
            severity="info", category="sale_alerts",
        )
        return "successful"
