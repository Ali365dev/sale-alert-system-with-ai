"""Analyse every email that has no Offer row yet and save an offer for it.

Sequential, per-item job with progress callbacks — runs the loop one email
at a time using ai.analyzer.build_offer to turn each AI result into a row.
Also covers "retry" — an email with no offer is either unprocessed or
previously failed, and both are picked up here the same way.

Before the AI call, ai.ocr extracts text from the email's images/GIFs and
merges it with the subject + body — the AI sees that merged document, never
just the raw body, so promotions hidden inside images aren't missed.
"""
import json
from datetime import datetime

from sqlalchemy import exists

from database.db import get_session
from database.models import Email, Offer
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
        from ai.analyzer import analyze_email, build_offer
        from ai.ocr import extract_and_merge
        from services import job_service
        from services.jobs.discover_brand import extract_domain, find_known_brand_by_domain, route_to_candidate_queue

        with get_session() as session:
            e = session.query(Email).filter(Email.id == item.id).first()
            if e is None:
                return "skipped"
            subject, body, sender = e.subject, e.body or "", e.sender or ""
            image_urls = json.loads(e.image_urls) if e.image_urls else []

        # Cheap, deterministic gate before spending any OCR/LLM budget: does
        # this sender already belong to a known brand? If not, route straight
        # to the Unknown Emails review queue instead of guessing — AI brand
        # identification happens later, on-demand, from that page.
        sender_domain = extract_domain(sender)
        if find_known_brand_by_domain(sender_domain) is None:
            route_to_candidate_queue(item.id, sender, sender_domain)
            job_service.append_log(
                job_id, f"↷ \"{item.label[:60]}\" routed to Unknown Emails (sender not matched to a known brand)",
                severity="warning", category="ai",
            )
            with get_session() as session:
                e = session.query(Email).filter(Email.id == item.id).first()
                if e is not None:
                    e.processing_status = "failed"
                    e.processing_error = "No matching brand — routed to Unknown Emails"
                    e.processing_attempted_at = datetime.utcnow()
            return "skipped"

        job_service.set_stage(job_id, "ocr")
        ocr_result = extract_and_merge(subject, body, image_urls)
        with get_session() as session:
            e = session.query(Email).filter(Email.id == item.id).first()
            if e is not None:
                e.ocr_text_raw = ocr_result["ocr_raw"] or None
                e.ocr_text_clean = ocr_result["ocr_clean"] or None
                e.ocr_processed_at = datetime.utcnow()

        job_service.set_stage(job_id, "ai_analysis")
        result = analyze_email(subject, ocr_result["merged"], sender)
        if result is None:
            job_service.append_log(job_id, f"⚠ AI returned no result for \"{item.label[:60]}\"", severity="warning", category="ai")
            with get_session() as session:
                e = session.query(Email).filter(Email.id == item.id).first()
                if e is not None:
                    e.processing_status = "failed"
                    e.processing_error = "AI returned no result"
                    e.processing_attempted_at = datetime.utcnow()
            return "failed"

        job_service.set_stage(job_id, "saving_data")
        with get_session() as session:
            session.add(build_offer(item.id, result))
            e = session.query(Email).filter(Email.id == item.id).first()
            if e is not None:
                e.processing_status = "processed"
                e.processing_error = None
                e.processing_attempted_at = datetime.utcnow()

        job_service.append_log(job_id, f"✓ \"{item.label[:60]}\" analysed and saved", severity="success", category="offer")
        job_service.set_stage(job_id, "processing")
        return "successful"
