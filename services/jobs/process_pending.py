"""Analyse every email that has no Offer row yet and save an offer for it.

Per-item, sequential version of scheduler/jobs.py::process_emails_without_offers
(left untouched there for app.py/Streamlit's use — this reuses its shared
_build_offer helper but runs the loop item-by-item with progress callbacks).
"""
from sqlalchemy import exists

from database.db import get_session
from database.models import Email, Offer
from scheduler.jobs import _build_offer
from services.jobs.base import BackgroundJob, WorkItem


class ProcessPendingJob(BackgroundJob):
    job_type = "process_pending"

    def collect_work(self, job: dict) -> list[WorkItem]:
        with get_session() as session:
            pending = (
                session.query(Email)
                .filter(~exists().where(Offer.email_id == Email.id))
                .order_by(Email.id.asc())
                .all()
            )
            return [WorkItem(id=e.id, label=e.subject) for e in pending]

    def process_item(self, job_id: int, item: WorkItem) -> str:
        from ai.analyzer import analyze_email
        from services import job_service

        with get_session() as session:
            e = session.query(Email).filter(Email.id == item.id).first()
            if e is None:
                return "skipped"
            subject, body = e.subject, e.body or ""

        job_service.set_stage(job_id, "ai_analysis")
        result = analyze_email(subject, body)
        if result is None:
            job_service.append_log(job_id, f"⚠ AI returned no result for \"{item.label[:60]}\"", severity="warning", category="ai")
            return "failed"

        job_service.set_stage(job_id, "saving_data")
        with get_session() as session:
            session.add(_build_offer(item.id, result))

        job_service.append_log(job_id, f"✓ \"{item.label[:60]}\" analysed and saved", severity="success", category="offer")
        job_service.set_stage(job_id, "processing")
        return "successful"
