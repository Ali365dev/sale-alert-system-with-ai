"""Periodically recheck active product sale alerts against live product pages."""
from services.jobs.base import BackgroundJob, WorkItem
from services.sale_alert_service import check_product_alert, list_active_product_alert_ids


class CheckSaleAlertsJob(BackgroundJob):
    job_type = "check_sale_alerts"

    def collect_work(self, job: dict) -> list[WorkItem]:
        from services import job_service

        payload = job.get("payload") or {}
        job_id = job.get("id")
        explicit_ids = payload.get("alert_ids")
        if explicit_ids:
            ids = [int(i) for i in explicit_ids]
        else:
            ids = list_active_product_alert_ids()

        if job_id:
            job_service.append_log(
                job_id,
                f"Checking {len(ids)} active product sale alert(s)",
                severity="info",
                category="sale_alerts",
            )
        return [WorkItem(id=aid, label=f"Sale alert #{aid}") for aid in ids]

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from services import job_service

        result = check_product_alert(int(item.id), notify=True)
        if not result.get("ok"):
            job_service.append_log(
                job_id,
                f"Alert #{item.id}: {result.get('error') or 'failed'}",
                severity="warning",
                category="sale_alerts",
            )
            return "failed" if result.get("error") not in {"missing product_url"} else "skipped"

        if result.get("triggered"):
            job_service.append_log(
                job_id,
                f"Alert #{item.id} TRIGGERED — {result.get('message')}",
                severity="info",
                category="sale_alerts",
            )
        else:
            job_service.append_log(
                job_id,
                f"Alert #{item.id}: checked (status={result.get('status')}, "
                f"price={result.get('current_price')})",
                severity="info",
                category="sale_alerts",
            )
        return "successful"
