"""Shared single-email reprocessing helper — the sender-domain gate + OCR +
AI-analysis + offer-replacement sequence used by both api/emails.py's
"Process"/"Reprocess" button and api/unknown_emails.py's "Create Brand" flow
(after linking a Brand and appending the sender domain to it, the email is
reprocessed so it gets a real Offer instead of just sitting in the queue)."""
import json
from datetime import datetime, timezone

from database.db import get_session
from database.models import Email, Offer
from services.jobs.discover_brand import extract_domain, find_known_brand_by_domain, route_to_candidate_queue


def reprocess_email(email_id: int) -> dict:
    """Returns {"processing_status": "processed"|"failed", "processing_error": str|None}."""
    from ai.analyzer import analyze_email, build_offer
    from ai.ocr import extract_and_merge

    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is None:
            return {"processing_status": "failed", "processing_error": "email not found"}
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
        return {"processing_status": "failed", "processing_error": "No matching brand — routed to Unknown Emails"}

    ocr_result = extract_and_merge(subject, body, image_urls)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is not None:
            e.ocr_text_raw = ocr_result["ocr_raw"] or None
            e.ocr_text_clean = ocr_result["ocr_clean"] or None
            e.ocr_processed_at = now

    result = analyze_email(subject, ocr_result["merged"], sender, received_at=received_at)
    if result is None:
        with get_session() as session:
            e = session.query(Email).filter(Email.id == email_id).first()
            if e is not None:
                e.processing_status = "failed"
                e.processing_error = "AI returned no result"
                e.processing_attempted_at = now
        return {"processing_status": "failed", "processing_error": "AI returned no result"}

    with get_session() as session:
        # Reprocessing replaces this email's offer(s) rather than piling up
        # duplicates alongside a stale/wrong one from a previous attempt.
        session.query(Offer).filter(Offer.email_id == email_id).delete()
        session.add(build_offer(email_id, result, received_at=received_at, subject=subject))
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is not None:
            e.processing_status = "processed"
            e.processing_error = None
            e.processing_attempted_at = now

    return {"processing_status": "processed", "processing_error": None}
