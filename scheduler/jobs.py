"""
Background job functions for fetching emails and running AI analysis.
Called directly from the Streamlit sidebar buttons.
"""
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import exists

from ai.analyzer import analyze_email
from config import logger
from database.db import get_session
from database.models import Email, Offer
from gmail.gmail_service import fetch_and_store_emails


def _parse_expiry(date_str) -> datetime | None:
    if not date_str:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%B %d, %Y"):
        try:
            return datetime.strptime(date_str, fmt)
        except (ValueError, TypeError):
            continue
    return None


def _build_offer(email_id: int, result: dict) -> Offer:
    return Offer(
        email_id=email_id,
        brand=result.get("brand"),
        company=result.get("company"),
        category=result.get("category"),
        subcategory=result.get("subcategory"),
        offer_type=result.get("offer_type"),
        discount_percentage=result.get("discount_percentage"),
        coupon_code=result.get("coupon_code"),
        expiry_date=_parse_expiry(result.get("expiry_date")),
        offer_value=result.get("offer_value"),
        website=result.get("website_url") or None,
        summary=result.get("summary"),
        key_highlights=json.dumps(result.get("key_highlights", [])),
        is_active=True,
        source="email",
    )


def fetch_emails_only() -> int:
    """Fetch and store new emails from Gmail. Returns count of new emails saved."""
    logger.info("=== Fetching emails from Gmail ===")
    try:
        new_emails = fetch_and_store_emails()
        logger.info("Fetched %d new email(s).", len(new_emails))
        return len(new_emails)
    except Exception as exc:
        logger.error("Failed to fetch emails: %s", exc)
        raise


def process_emails_without_offers() -> tuple[int, int]:
    """
    Find all emails that have no offer rows and run AI analysis on them.
    Returns (processed, failed).
    """
    logger.info("=== Processing emails without offers ===")

    with get_session() as session:
        pending = (
            session.query(Email)
            .filter(~exists().where(Offer.email_id == Email.id))
            .order_by(Email.id.asc())
            .all()
        )
        # snapshot fields before session closes
        pending_data = [
            {"id": e.id, "subject": e.subject, "body": e.body or ""}
            for e in pending
        ]

    logger.info("Found %d email(s) with no offers.", len(pending_data))

    processed, failed = 0, 0
    for email in pending_data:
        email_id = email["id"]
        subject = email["subject"]
        body = email["body"]
        logger.info("Analysing email id=%s subject=%r", email_id, subject[:60])
        try:
            result = analyze_email(subject, body)
            if result is None:
                logger.warning("AI returned no result for email id=%s", email_id)
                failed += 1
                continue

            offer = _build_offer(email_id, result)
            with get_session() as session:
                session.add(offer)
            processed += 1
            logger.info(
                "  ✓ Offer saved — brand=%r category=%r discount=%s%%",
                offer.brand, offer.category, offer.discount_percentage or "?",
            )
        except Exception as exc:
            logger.error("Error analysing email id=%s: %s", email_id, exc)
            failed += 1

    logger.info("=== Done — %d processed, %d failed ===", processed, failed)
    return processed, failed


def process_emails() -> None:
    """Core job: fetch new emails → analyse → store offers. Also catches up on any
    previously fetched emails that are missing offers."""
    logger.info("=== Email processing job started ===")
    start = datetime.utcnow()

    # 1. Fetch new emails from Gmail
    try:
        new_emails: list[dict] = fetch_and_store_emails()
    except Exception as exc:
        logger.error("Failed to fetch emails from Gmail: %s", exc)
        return

    # 2. Also grab any older emails that never got an offer (AI failures etc.)
    with get_session() as session:
        pending = (
            session.query(Email)
            .filter(~exists().where(Offer.email_id == Email.id))
            .order_by(Email.id.asc())
            .all()
        )
        pending_data = [
            {"id": e.id, "subject": e.subject, "body": e.body or ""}
            for e in pending
        ]

    # Merge: new_emails + any older pending (avoid duplicates)
    new_ids = {e["id"] for e in new_emails}
    all_to_process = new_emails + [e for e in pending_data if e["id"] not in new_ids]

    if not all_to_process:
        logger.info("No emails to process.")
        return

    logger.info("Processing %d email(s) total (%d new, %d catch-up).",
                len(all_to_process), len(new_emails),
                len(all_to_process) - len(new_emails))

    processed, failed = 0, 0
    for email in all_to_process:
        email_id = email["id"]
        subject = email.get("subject", "")
        body = email.get("body", "")
        logger.info("Analysing email id=%s subject=%r", email_id, subject[:60])
        try:
            result = analyze_email(subject, body)
            if result is None:
                failed += 1
                continue

            offer = _build_offer(email_id, result)
            with get_session() as session:
                session.add(offer)
            processed += 1
            logger.info(
                "  ✓ Offer saved — brand=%r category=%r/%r discount=%s%%",
                offer.brand, offer.category, offer.subcategory,
                offer.discount_percentage or "?",
            )
        except Exception as exc:
            logger.error("Error processing email id=%s: %s", email_id, exc)
            failed += 1

    elapsed = (datetime.utcnow() - start).total_seconds()
    logger.info(
        "=== Job done in %.1fs — %d processed, %d failed ===",
        elapsed, processed, failed,
    )


