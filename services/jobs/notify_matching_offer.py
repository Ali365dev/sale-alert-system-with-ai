"""Send an FCM alert to devices whose saved brands/categories match one offer."""
from database.db import get_session
from database.models import DeviceToken, Offer, OfferNotification
from services.jobs.base import BackgroundJob, WorkItem
from services.offer_matching import matching_profile_rows
from services.offer_notifications import notification_copy
from services.push import fcm_client

_BATCH_SIZE = 500
_DEAD_TOKEN_ERRORS = {"UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"}


class NotifyMatchingOfferJob(BackgroundJob):
    job_type = "notify_matching_offer"

    def collect_work(self, job: dict) -> list[WorkItem]:
        payload = job.get("payload") or {}
        offer_id = payload.get("offer_id")
        if not offer_id:
            return []

        with get_session() as session:
            offer = session.query(Offer).filter(Offer.id == offer_id, Offer.is_active.is_(True)).first()
            if offer is None:
                return []
            profiles = matching_profile_rows(session, offer)
            if not profiles:
                return []

            device_ids = [d for d, _uid in profiles if d]
            already = {
                row.device_id
                for row in session.query(OfferNotification.device_id).filter(
                    OfferNotification.offer_id == offer_id,
                    OfferNotification.device_id.in_(device_ids),
                )
            }
            pending_ids = [d for d in device_ids if d not in already]
            if not pending_ids:
                return []

            tokens = (
                session.query(DeviceToken)
                .filter(
                    DeviceToken.is_active.is_(True),
                    DeviceToken.device_id.in_(pending_ids),
                )
                .all()
            )
            user_by_device = {d: uid for d, uid in profiles}
            recipients = [
                {"token": row.token, "device_id": row.device_id, "user_id": user_by_device.get(row.device_id)}
                for row in tokens
                if row.token and row.device_id
            ]

        batches = [recipients[i:i + _BATCH_SIZE] for i in range(0, len(recipients), _BATCH_SIZE)]
        return [
            WorkItem(id=batch, label=f"Offer {offer_id}: {len(batch)} device(s)")
            for batch in batches
        ]

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from services import job_service

        payload = job_service.get_job(job_id)["payload"] or {}
        offer_id = payload.get("offer_id")
        recipients: list[dict] = item.id
        if not offer_id or not recipients:
            return "skipped"

        with get_session() as session:
            offer = session.query(Offer).filter(Offer.id == offer_id).first()
            if offer is None:
                return "skipped"
            title, body, data = notification_copy(offer)

        tokens = [r["token"] for r in recipients]
        response = fcm_client.send_multicast(tokens, title, body, data)

        dead_tokens = []
        sent_devices = []
        for recipient, resp in zip(recipients, response.responses):
            if resp.success:
                sent_devices.append(recipient)
                continue
            code = getattr(resp.exception, "code", None) or getattr(resp.exception, "reason", None)
            if str(code).upper() in _DEAD_TOKEN_ERRORS:
                dead_tokens.append(recipient["token"])

        if sent_devices:
            with get_session() as session:
                for recipient in sent_devices:
                    exists = (
                        session.query(OfferNotification.id)
                        .filter_by(device_id=recipient["device_id"], offer_id=offer_id)
                        .first()
                    )
                    if exists:
                        continue
                    session.add(OfferNotification(
                        device_id=recipient["device_id"],
                        offer_id=offer_id,
                        user_id=recipient.get("user_id"),
                    ))

        if dead_tokens:
            with get_session() as session:
                session.query(DeviceToken).filter(DeviceToken.token.in_(dead_tokens)).update(
                    {"is_active": False}, synchronize_session=False,
                )

        from services import job_service as js
        js.append_log(
            job_id,
            f"{item.label}: {response.success_count} sent, {response.failure_count} failed"
            + (f" ({len(dead_tokens)} device(s) deactivated)" if dead_tokens else ""),
            severity="success" if response.failure_count == 0 else "warning",
            category="push",
        )
        return "successful" if response.success_count > 0 else "failed"