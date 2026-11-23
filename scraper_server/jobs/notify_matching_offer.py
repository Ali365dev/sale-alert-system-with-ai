"""Send an FCM alert to devices whose saved brands/categories match one offer."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import func

from config import logger
from database.db import get_session
from database.models import DeviceToken, Email, Offer, OfferNotification
from services.jobs.base import BackgroundJob, WorkItem
from services.offer_matching import matching_profile_rows
from services.offer_notifications import notification_copy
from services.push import fcm_client

_BATCH_SIZE = 500
_DEAD_TOKEN_ERRORS = {"UNREGISTERED", "INVALID_ARGUMENT", "NOT_FOUND"}
# Bulk-processing old mail ("Process all unprocessed", recovery) creates
# offers for sales that are long over — those are kept, but not pushed.
_MAX_PUSH_EMAIL_AGE = timedelta(days=7)
_SAME_CONTENT_WINDOW = timedelta(days=7)


def stale_reason(offer, email_received_at) -> str | None:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    if offer.expiry_date and offer.expiry_date < now:
        return "offer already expired"
    if email_received_at and now - email_received_at > _MAX_PUSH_EMAIL_AGE:
        return f"source email is {(now - email_received_at).days} days old"
    return None


def _stale_reason_for(offer_id: int) -> str | None:
    with get_session() as session:
        row = (
            session.query(Offer, Email.received_date)
            .outerjoin(Email, Email.id == Offer.email_id)
            .filter(Offer.id == offer_id)
            .first()
        )
        return stale_reason(row[0], row[1]) if row else None


def _recently_sent_same_content(session, offer, device_ids: list[str]) -> set[str]:
    """Brands often send the same campaign email twice, which becomes two
    offers with the same brand and title — without this, the same push
    arrived twice."""
    if not offer.title or not offer.brand or not device_ids:
        return set()
    since = datetime.now(timezone.utc).replace(tzinfo=None) - _SAME_CONTENT_WINDOW
    rows = (
        session.query(OfferNotification.device_id)
        .join(Offer, Offer.id == OfferNotification.offer_id)
        .filter(
            OfferNotification.device_id.in_(device_ids),
            OfferNotification.created_at >= since,
            Offer.id != offer.id,
            func.lower(Offer.brand) == offer.brand.lower(),
            func.lower(Offer.title) == offer.title.lower(),
        )
    )
    return {row.device_id for row in rows}


class NotifyMatchingOfferJob(BackgroundJob):
    job_type = "notify_matching_offer"

    def collect_work(self, job: dict) -> list[WorkItem]:
        from services import job_service

        payload = job.get("payload") or {}
        offer_id = payload.get("offer_id")
        job_id = job.get("id")
        if not offer_id:
            return []

        reason = _stale_reason_for(offer_id)
        if reason:
            if job_id:
                job_service.append_log(
                    job_id, f"Offer #{offer_id}: not notifying — {reason}", severity="info", category="push",
                )
            return []

        self._match_sale_alerts(job_id, offer_id)

        if not fcm_client.is_configured():
            if job_id:
                job_service.append_log(
                    job_id, f"Offer #{offer_id}: Firebase not configured — preference push skipped",
                    severity="warning", category="push",
                )
            return []

        with get_session() as session:
            offer = session.query(Offer).filter(Offer.id == offer_id, Offer.is_active.is_(True)).first()
            if offer is None:
                if job_id:
                    job_service.append_log(
                        job_id, f"Offer #{offer_id} missing or inactive — nothing to notify",
                        severity="warning", category="push",
                    )
                return []
            profiles = matching_profile_rows(session, offer)
            if not profiles:
                if job_id:
                    job_service.append_log(
                        job_id,
                        f"Offer #{offer_id}: no user profiles match brand/categories "
                        f"({offer.brand!r} / {offer.category!r})",
                        severity="info", category="push",
                    )
                return []

            device_ids = [d for d, _uid in profiles if d]
            already = {
                row.device_id
                for row in session.query(OfferNotification.device_id).filter(
                    OfferNotification.offer_id == offer_id,
                    OfferNotification.device_id.in_(device_ids),
                )
            }
            already |= _recently_sent_same_content(session, offer, device_ids)
            pending_ids = [d for d in device_ids if d not in already]
            if not pending_ids:
                if job_id:
                    job_service.append_log(
                        job_id,
                        f"Offer #{offer_id}: {len(device_ids)} matching profile(s), "
                        f"all already notified",
                        severity="info", category="push",
                    )
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

            if not recipients and job_id:
                inactive_linked = (
                    session.query(DeviceToken.id)
                    .filter(
                        DeviceToken.is_active.is_(False),
                        DeviceToken.device_id.in_(pending_ids),
                    )
                    .count()
                )
                job_service.append_log(
                    job_id,
                    f"Offer #{offer_id}: {len(profiles)} matching profile(s), "
                    f"{len(pending_ids)} pending, 0 active FCM tokens "
                    f"({inactive_linked} inactive token(s) for those devices — "
                    f"users must reopen the app to re-register)",
                    severity="warning", category="push",
                )

        batches = [recipients[i:i + _BATCH_SIZE] for i in range(0, len(recipients), _BATCH_SIZE)]
        return [
            WorkItem(id=batch, label=f"Offer {offer_id}: {len(batch)} device(s)")
            for batch in batches
        ]

    def _match_sale_alerts(self, job_id: int | None, offer_id: int) -> None:
        from services import job_service
        from services.sale_alert_service import match_brand_alerts_for_offer

        try:
            result = match_brand_alerts_for_offer(offer_id, notify=True)
        except Exception as exc:
            logger.exception("Failed matching brand sale alerts for offer %s", offer_id)
            if job_id:
                job_service.append_log(
                    job_id, f"Offer #{offer_id}: brand sale-alert matching failed — {exc}",
                    severity="warning", category="sale_alerts",
                )
            return
        if result.get("matched") and job_id:
            job_service.append_log(
                job_id, f"Offer #{offer_id}: matched {result['matched']} brand sale alert(s)",
                severity="info", category="sale_alerts",
            )

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
            image = offer.image_url if (offer.image_url or "").startswith("https://") else None

        tokens = [r["token"] for r in recipients]
        response = fcm_client.send_multicast(tokens, title, body, data, image=image)

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
                already_notified = {
                    device_id for (device_id,) in (
                        session.query(OfferNotification.device_id)
                        .filter(
                            OfferNotification.offer_id == offer_id,
                            OfferNotification.device_id.in_([r["device_id"] for r in sent_devices]),
                        )
                        .all()
                    )
                }
                for recipient in sent_devices:
                    if recipient["device_id"] in already_notified:
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