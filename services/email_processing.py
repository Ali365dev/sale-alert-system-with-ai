"""Shared single-email reprocessing helper — the sender-domain gate + OCR +
AI-analysis + offer-replacement sequence used by api/emails.py's
"Process"/"Reprocess" button, api/unknown_emails.py's "Create Brand" flow
(after linking a Brand and appending the sender domain to it, the email is
reprocessed so it gets a real Offer instead of just sitting in the queue),
and services/jobs/email_automation.py's automatic new-email pipeline — this
is the one `process_email(message_id)`-equivalent core all three call into,
not three separate implementations."""
import json
from datetime import datetime, timezone
from typing import Callable, Optional

from database.db import get_session
from database.models import Email, Offer
from services.jobs.discover_brand import extract_domain, find_known_brand_by_domain, route_to_candidate_queue


def reprocess_email(
    email_id: int,
    on_event: Optional[Callable[[dict], None]] = None,
    apply_sale_filter: bool = True,
) -> dict:
    """Returns {"processing_status": "processed"|"failed", "processing_error":
    str|None, "offer_id": int|None}. `on_event`, if given, is forwarded to
    ai.analyzer.analyze_email() for AI-provider-fallback logging (e.g. via
    services.ai_job_logging.make_provider_event_logger) — optional and
    unused by the manual Process/Reprocess and Create Brand callers, which
    don't run inside a Job with logs to write to.

    `apply_sale_filter` gates the pre-AI sale-content relevance filter
    (ai/sale_filter.py) — on by default for services/jobs/email_automation.py's
    automatic pipeline, where it's meant to save API budget across many
    unattended emails. The manual Process/Reprocess button and the
    Create-Brand flow (app/api/routers/emails.py, app/api/routers/
    unknown_emails.py) pass False: a human already deliberately chose this
    one email, so the filter shouldn't second-guess that."""
    from ai.analyzer import analyze_email, build_offer
    from ai.ocr import extract_and_merge

    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is None:
            return {"processing_status": "failed", "processing_error": "email not found", "offer_id": None}
        subject, body, sender = e.subject, e.body or "", e.sender or ""
        received_at = e.received_date or e.processed_at
        image_urls = json.loads(e.image_urls) if e.image_urls else []

    # Same deterministic sender-domain gate as the bulk pipeline
    # (services/jobs/process_pending.py). When called right after "Create
    # Brand" links a new sender domain onto a Brand, this naturally passes —
    # no bypass flag needed, the gate just sees the freshly-committed domain.
    sender_domain = extract_domain(sender)
    if find_known_brand_by_domain(sender_domain) is None:
        route_to_candidate_queue(email_id, sender, sender_domain)
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        with get_session() as session:
            e = session.query(Email).filter(Email.id == email_id).first()
            if e is not None:
                e.processing_status = "failed"
                e.processing_error = "No matching brand — routed to Unknown Emails"
                e.processing_attempted_at = now
        return {
            "processing_status": "failed",
            "processing_error": "No matching brand — routed to Unknown Emails",
            "offer_id": None,
        }

    ocr_result = extract_and_merge(subject, body, image_urls)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is not None:
            e.ocr_text_raw = ocr_result["ocr_raw"] or None
            e.ocr_text_clean = ocr_result["ocr_clean"] or None
            e.ocr_processed_at = now

    if apply_sale_filter:
        from ai.sale_filter import NOT_SALE_RELATED, evaluate as evaluate_sale_relevance

        relevance = evaluate_sale_relevance(subject, body, ocr_result["ocr_clean"])
        with get_session() as session:
            e = session.query(Email).filter(Email.id == email_id).first()
            if e is not None:
                e.sale_relevance_score = relevance.score
                e.filter_status = relevance.status
                e.filter_reason = relevance.reason

        if relevance.status == NOT_SALE_RELATED:
            error = "Not sale-related — filtered before AI analysis"
            with get_session() as session:
                e = session.query(Email).filter(Email.id == email_id).first()
                if e is not None:
                    e.processing_status = "failed"
                    e.processing_error = error
                    e.processing_attempted_at = now
            return {"processing_status": "failed", "processing_error": error, "offer_id": None}

    result = analyze_email(subject, ocr_result["merged"], sender, received_at=received_at, on_event=on_event)
    if result is None:
        with get_session() as session:
            e = session.query(Email).filter(Email.id == email_id).first()
            if e is not None:
                e.processing_status = "failed"
                e.processing_error = "AI returned no result"
                e.processing_attempted_at = now
        return {"processing_status": "failed", "processing_error": "AI returned no result", "offer_id": None}

    with get_session() as session:
        # Reprocessing replaces this email's offer(s) rather than piling up
        # duplicates alongside a stale/wrong one from a previous attempt.
        session.query(Offer).filter(Offer.email_id == email_id).delete()
        offer = build_offer(email_id, result, received_at=received_at, subject=subject)
        session.add(offer)
        session.flush()
        offer_id = offer.id
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is not None:
            e.processing_status = "processed"
            e.processing_error = None
            e.processing_attempted_at = now

    return {"processing_status": "processed", "processing_error": None, "offer_id": offer_id}
