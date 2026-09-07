"""Email manager endpoints — list raw fetched emails and classify them via
AI. Ported from api/emails.py — logic and response shape unchanged; the
duplicated page/page_size parsing now comes from app/api/dependencies.py."""
import json
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import case, func, or_

from app.api.dependencies import Pagination, pagination
from database.db import get_session
from database.models import BrandCandidate, Email, Offer

router = APIRouter(prefix="/api/emails", tags=["emails"])

_verify_all_state = {"running": False, "done": 0, "total": 0, "failed": 0}

_PROCESSING_STATUSES = ("unprocessed", "processed", "failed")
_SORT_COLUMNS = {
    "received_date": Email.received_date,
    "sender": Email.sender,
    "subject": Email.subject,
    "processing_status": Email.processing_status,
    "id": Email.id,
}


def _gmail_link(gmail_message_id: str | None) -> str | None:
    if not gmail_message_id:
        return None
    return f"https://mail.google.com/mail/u/0/#all/{gmail_message_id}"


def _image_count(e: Email) -> int:
    try:
        return len(json.loads(e.image_urls)) if e.image_urls else 0
    except (json.JSONDecodeError, TypeError):
        return 0


def _email_summary(e: Email, offers_count: int, brand: str | None = None) -> dict:
    return {
        "id": e.id,
        "sender": e.sender,
        "subject": e.subject,
        "brand": brand,
        "gmail_message_id": e.gmail_message_id,
        "gmail_link": _gmail_link(e.gmail_message_id),
        "received_date": e.received_date.isoformat() if e.received_date else None,
        "processed_at": e.processed_at.isoformat() if e.processed_at else None,
        "status": e.email_verification_status,
        "note": e.email_verification_note,
        "verified_at": e.email_verified_at.isoformat() if e.email_verified_at else None,
        "processing_status": e.processing_status,
        "processing_error": e.processing_error,
        "processing_attempted_at": e.processing_attempted_at.isoformat() if e.processing_attempted_at else None,
        "offers_count": offers_count,
        "image_count": _image_count(e),
    }


def _email_detail(e: Email, offers_count: int, brand: str | None = None) -> dict:
    try:
        image_urls = json.loads(e.image_urls) if e.image_urls else []
    except (json.JSONDecodeError, TypeError):
        image_urls = []
    return {
        **_email_summary(e, offers_count, brand),
        "body": e.body,
        "image_urls": image_urls,
        "ocr_text_raw": e.ocr_text_raw,
        "ocr_text_clean": e.ocr_text_clean,
        "ocr_processed_at": e.ocr_processed_at.isoformat() if e.ocr_processed_at else None,
    }


@router.get("")
def list_emails(
    status: str | None = Query(None),
    processing_status: str | None = Query(None),
    brand: str | None = Query(None),
    q: str | None = Query(None),
    sort: str = Query("received_date"),
    sort_dir: str = Query("desc"),
    page_params: Pagination = Depends(pagination),
):
    search = (q or "").strip()
    page, page_size = page_params.page, page_params.page_size

    sort_col = _SORT_COLUMNS.get(sort, Email.received_date)
    order = sort_col.asc() if sort_dir == "asc" else sort_col.desc()

    with get_session() as session:
        counts: dict[int, int] = {}
        brand_by_email: dict[int, str] = {}
        for email_id, offer_count, offer_brand in (
            session.query(Offer.email_id, func.count(Offer.id), func.min(Offer.brand))
            .filter(Offer.email_id.isnot(None))
            .group_by(Offer.email_id)
        ):
            counts[email_id] = offer_count
            if offer_brand:
                brand_by_email[email_id] = offer_brand

        eq = session.query(Email)

        if status == "unverified":
            eq = eq.filter(Email.email_verification_status.is_(None))
        elif status:
            eq = eq.filter(Email.email_verification_status == status)

        if processing_status in _PROCESSING_STATUSES:
            eq = eq.filter(Email.processing_status == processing_status)

        if brand:
            brand_email_ids = session.query(Offer.email_id).filter(Offer.email_id.isnot(None), Offer.brand == brand)
            eq = eq.filter(Email.id.in_(brand_email_ids))

        if search:
            like = f"%{search}%"
            brand_matched_ids = session.query(Offer.email_id).filter(Offer.email_id.isnot(None), Offer.brand.ilike(like))
            eq = eq.filter(
                or_(
                    Email.sender.ilike(like),
                    Email.subject.ilike(like),
                    Email.gmail_message_id.ilike(like),
                    Email.body.ilike(like),
                    Email.id.in_(brand_matched_ids),
                )
            )

        total = eq.count()
        emails = eq.order_by(order).offset(page_params.offset).limit(page_size).all()

        rows = [_email_summary(e, counts.get(e.id, 0), brand_by_email.get(e.id)) for e in emails]

        grand_total, legitimate, suspicious, spam, processed, unprocessed, failed = session.query(
            func.count(Email.id),
            func.count(case((Email.email_verification_status == "legitimate", 1))),
            func.count(case((Email.email_verification_status == "suspicious", 1))),
            func.count(case((Email.email_verification_status == "spam", 1))),
            func.count(case((Email.processing_status == "processed", 1))),
            func.count(case((Email.processing_status == "unprocessed", 1))),
            func.count(case((Email.processing_status == "failed", 1))),
        ).one()
        unverified = max(grand_total - legitimate - suspicious - spam, 0)
        offers_found = session.query(func.count(Offer.id)).scalar() or 0

    return {
        "emails": rows,
        "total": total,
        "page": page,
        "page_size": page_size,
        "summary": {
            "total": grand_total,
            "unverified": unverified,
            "legitimate": legitimate,
            "suspicious": suspicious,
            "spam": spam,
            "processed": processed,
            "unprocessed": unprocessed,
            "failed": failed,
            "offers_found": offers_found,
        },
    }


@router.get("/{email_id}")
def get_email(email_id: int):
    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        offers_count = session.query(func.count(Offer.id)).filter(Offer.email_id == email_id).scalar() or 0
        brand = (
            session.query(Offer.brand)
            .filter(Offer.email_id == email_id, Offer.brand.isnot(None))
            .limit(1)
            .scalar()
        )
        return _email_detail(e, offers_count, brand)


@router.delete("/{email_id}")
def delete_email(email_id: int):
    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        # Offer has cascade="all, delete-orphan" on Email.offers, but
        # BrandCandidate.email_id is a plain FK with no cascade — deleting an
        # email that was routed to the unknown-brand review queue would
        # otherwise fail with a ForeignKeyViolation.
        session.query(BrandCandidate).filter(BrandCandidate.email_id == email_id).delete()
        session.delete(e)
    return {"status": "deleted"}


@router.post("/{email_id}/process")
def process_email_endpoint(email_id: int):
    """Analyse a single email now — used for both the first attempt on an
    unprocessed email and for "Reprocess" on a failed or already-processed
    one. Synchronous (one email, not a bulk job) so the UI gets an immediate
    result; bulk processing still goes through the process_pending job —
    both this endpoint and app/api/routers/unknown_emails.py's "Create Brand"
    flow share the same sequence via services/email_processing.py::reprocess_email."""
    from services.email_processing import reprocess_email

    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is None:
            return JSONResponse({"error": "not found"}, status_code=404)

    return reprocess_email(email_id)


@router.post("/{email_id}/verify")
def verify_email_endpoint(email_id: int):
    from ai.verifier import verify_email_content

    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        sender, subject, body = e.sender, e.subject, e.body

    result = verify_email_content(sender, subject, body)
    if result is None:
        return JSONResponse({"error": "verification failed"}, status_code=502)

    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        e.email_verification_status = result["status"]
        e.email_verification_note = result["reason"]
        e.email_verified_at = datetime.now(timezone.utc).replace(tzinfo=None)

    return result


_VALID_EMAIL_STATUSES = {"legitimate", "suspicious", "spam"}


def _run_verify_all(statuses: list[str] | None = None):
    from ai.verifier import verify_email_content

    with get_session() as session:
        query = session.query(Email.id)
        query = query.filter(Email.email_verification_status.in_(statuses)) if statuses else query.filter(Email.email_verification_status.is_(None))
        pending_ids = [e.id for e in query.all()]

    _verify_all_state.update({"running": True, "done": 0, "total": len(pending_ids), "failed": 0})
    for email_id in pending_ids:
        try:
            with get_session() as session:
                e = session.query(Email).filter(Email.id == email_id).first()
                if e is None:
                    continue
                sender, subject, body = e.sender, e.subject, e.body

            result = verify_email_content(sender, subject, body)
            if result:
                with get_session() as session:
                    e = session.query(Email).filter(Email.id == email_id).first()
                    if e:
                        e.email_verification_status = result["status"]
                        e.email_verification_note = result["reason"]
                        e.email_verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
            else:
                _verify_all_state["failed"] += 1
        except Exception:
            _verify_all_state["failed"] += 1
        finally:
            _verify_all_state["done"] += 1

    _verify_all_state["running"] = False


@router.post("/verify-all")
def verify_all_emails(body: dict = Body(default={})):
    if _verify_all_state["running"]:
        return JSONResponse({"status": "already_running"}, status_code=409)
    statuses = [s for s in (body or {}).get("statuses") or [] if s in _VALID_EMAIL_STATUSES]
    threading.Thread(target=_run_verify_all, args=(statuses or None,), daemon=True).start()
    return JSONResponse({"status": "started"}, status_code=202)


@router.get("/verify-all/status")
def verify_all_status():
    return _verify_all_state
