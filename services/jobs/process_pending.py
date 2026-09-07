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
            received_at = e.received_date or e.processed_at
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

        from ai.sale_filter import NOT_SALE_RELATED, evaluate as evaluate_sale_relevance

        relevance = evaluate_sale_relevance(subject, body, ocr_result["ocr_clean"])
        with get_session() as session:
            e = session.query(Email).filter(Email.id == item.id).first()
            if e is not None:
                e.sale_relevance_score = relevance.score
                e.filter_status = relevance.status
                e.filter_reason = relevance.reason

        if relevance.status == NOT_SALE_RELATED:
            job_service.append_log(
                job_id, f"↷ \"{item.label[:60]}\" filtered out before AI (score={relevance.score}: {relevance.reason})",
                severity="info", category="ai",
            )
            with get_session() as session:
                e = session.query(Email).filter(Email.id == item.id).first()
                if e is not None:
                    e.processing_status = "failed"
                    e.processing_error = "Not sale-related — filtered before AI analysis"
                    e.processing_attempted_at = datetime.utcnow()
            return "skipped"

        job_service.set_stage(job_id, "ai_analysis")
        from ai._llm import describe_active_provider
        from ai.analyzer import get_last_failure_info
        from services.ai_job_logging import failure_info_or_default, make_provider_event_logger, provider_key_lines

        active = describe_active_provider()
        job_service.append_log(job_id, f"→ Analysing \"{item.label[:60]}\"\n{provider_key_lines(active)}", category="ai")

        result = analyze_email(
            subject, ocr_result["merged"], sender, received_at=received_at,
            on_event=make_provider_event_logger(job_id, item.label),
        )
        if result is None:
            failure_info = failure_info_or_default(get_last_failure_info())
            job_service.append_log(
                job_id, f"⚠ ✗ Failed to analyse \"{item.label[:60]}\"\nReason: {failure_info['failure_reason']}",
                severity="warning", category="ai",
            )
            with get_session() as session:
                e = session.query(Email).filter(Email.id == item.id).first()
                if e is not None:
                    e.processing_status = "failed"
                    e.processing_error = failure_info["failure_reason"]
                    e.processing_attempted_at = datetime.utcnow()
                    e.failure_reason = failure_info.get("failure_reason")
                    e.failure_error_code = failure_info.get("error_code")
                    e.failure_provider = failure_info.get("provider")
                    e.failure_key_identifier = failure_info.get("key_identifier")
                    e.failure_attempt_count = failure_info.get("attempt_count")
            return "failed"

        job_service.set_stage(job_id, "saving_data")
        with get_session() as session:
            session.add(build_offer(item.id, result, received_at=received_at, subject=subject))
            e = session.query(Email).filter(Email.id == item.id).first()
            if e is not None:
                e.processing_status = "processed"
                e.processing_error = None
                e.processing_attempted_at = datetime.utcnow()
                # Clear any stale failure detail from a previous failed attempt on this email.
                e.failure_reason = None
                e.failure_error_code = None
                e.failure_provider = None
                e.failure_key_identifier = None
                e.failure_attempt_count = None

        job_service.append_log(job_id, f"✓ \"{item.label[:60]}\" analysed and saved", severity="success", category="offer")
        job_service.set_stage(job_id, "processing")
        return "successful"
