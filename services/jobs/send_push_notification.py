"""Fan a single admin-composed push notification out to every active device,
via FCM's multicast API (500 tokens per call). Payload shape (set by
api/notifications.py's /send endpoint): {"title": str, "body": str, "data":
dict | None}.
"""
from database.db import get_session
from database.models import DeviceToken
from services.jobs.base import BackgroundJob, WorkItem
from services.push import fcm_client

_BATCH_SIZE = 500  # FCM's cap per send_each_for_multicast call

# FCM error codes that mean the token is permanently dead — safe to deactivate.
_DEAD_TOKEN_ERRORS = {"UNREGISTERED", "INVALID_ARGUMENT"}


class SendPushNotificationJob(BackgroundJob):
    job_type = "send_push_notification"

    def collect_work(self, job: dict) -> list[WorkItem]:
        with get_session() as session:
            tokens = [
                row.token for row in
                session.query(DeviceToken.token).filter(DeviceToken.is_active.is_(True)).all()
            ]

        batches = [tokens[i:i + _BATCH_SIZE] for i in range(0, len(tokens), _BATCH_SIZE)]
        return [
            WorkItem(id=batch, label=f"Batch of {len(batch)} device(s)")
            for batch in batches
        ]

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from services import job_service

        payload = job_service.get_job(job_id)["payload"] or {}
        title = payload.get("title", "")
        body = payload.get("body", "")
        data = payload.get("data")

        tokens: list[str] = item.id
        response = fcm_client.send_multicast(tokens, title, body, data)

        dead_tokens = []
        for token, resp in zip(tokens, response.responses):
            if resp.success:
                continue
            code = getattr(resp.exception, "code", None) or getattr(resp.exception, "reason", None)
            if str(code).upper() in _DEAD_TOKEN_ERRORS:
                dead_tokens.append(token)

        if dead_tokens:
            with get_session() as session:
                (
                    session.query(DeviceToken)
                    .filter(DeviceToken.token.in_(dead_tokens))
                    .update({"is_active": False}, synchronize_session=False)
                )

        job_service.append_log(
            job_id,
            f"{item.label}: {response.success_count} sent, {response.failure_count} failed"
            + (f" ({len(dead_tokens)} device(s) deactivated)" if dead_tokens else ""),
            severity="success" if response.failure_count == 0 else "warning",
            category="push",
        )

        return "successful" if response.success_count > 0 else "failed"

    def after_run(self, job_id: int, job: dict) -> None:
        from services import job_service

        with get_session() as session:
            total_devices = session.query(DeviceToken).filter(DeviceToken.is_active.is_(True)).count()

        job_service.set_result(job_id, {
            "sent_batches": job["successful"],
            "failed_batches": job["failed"],
            "total_devices_at_send": total_devices,
        })
