"""Email manager endpoints — list raw fetched emails and classify them via AI."""
import json
import threading
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_

from database.db import get_session
from database.models import Email, Offer

bp = Blueprint("emails", __name__, url_prefix="/api/emails")

_verify_all_state = {"running": False, "done": 0, "total": 0, "failed": 0}

_PAGE_SIZES = (10, 25, 50, 100)
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


@bp.get("")
def list_emails():
    status = request.args.get("status")  # verification status: legitimate/suspicious/spam/unverified
    processing_status = request.args.get("processing_status")  # unprocessed/processed/failed
    search = (request.args.get("q") or "").strip()
    sort = request.args.get("sort", "received_date")
    sort_dir = request.args.get("sort_dir", "desc")

    try:
        page = max(1, int(request.args.get("page", 1)))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = int(request.args.get("page_size", 25))
    except (TypeError, ValueError):
        page_size = 25
    if page_size not in _PAGE_SIZES:
        page_size = 25

    sort_col = _SORT_COLUMNS.get(sort, Email.received_date)
    order = sort_col.asc() if sort_dir == "asc" else sort_col.desc()

    with get_session() as session:
        counts = dict(
            session.query(Offer.email_id, func.count(Offer.id)).group_by(Offer.email_id).all()
        )
        # One brand per email (first offer that has one) — used for both the
        # Brand column and brand-name search matching below.
        brand_by_email: dict[int, str] = {}
        for email_id, brand in session.query(Offer.email_id, Offer.brand).filter(Offer.email_id.isnot(None)):
            if brand and email_id not in brand_by_email:
                brand_by_email[email_id] = brand

        q = session.query(Email)

        if status == "unverified":
            q = q.filter(Email.email_verification_status.is_(None))
        elif status:
            q = q.filter(Email.email_verification_status == status)

        if processing_status in _PROCESSING_STATUSES:
            q = q.filter(Email.processing_status == processing_status)

        if search:
            like = f"%{search}%"
            brand_matched_ids = session.query(Offer.email_id).filter(Offer.email_id.isnot(None), Offer.brand.ilike(like))
            q = q.filter(
                or_(
                    Email.sender.ilike(like),
                    Email.subject.ilike(like),
                    Email.gmail_message_id.ilike(like),
                    Email.body.ilike(like),
                    Email.id.in_(brand_matched_ids),
                )
            )

        total = q.count()
        emails = q.order_by(order).offset((page - 1) * page_size).limit(page_size).all()

        rows = [_email_summary(e, counts.get(e.id, 0), brand_by_email.get(e.id)) for e in emails]

        # Summary counts always reflect the full table, not the current
        # filters — matches the Offers Manager pattern of stable headline counts.
        grand_total = session.query(func.count(Email.id)).scalar() or 0
        legitimate = session.query(func.count(Email.id)).filter(Email.email_verification_status == "legitimate").scalar() or 0
        suspicious = session.query(func.count(Email.id)).filter(Email.email_verification_status == "suspicious").scalar() or 0
        spam = session.query(func.count(Email.id)).filter(Email.email_verification_status == "spam").scalar() or 0
        unverified = max(grand_total - legitimate - suspicious - spam, 0)
        processed = session.query(func.count(Email.id)).filter(Email.processing_status == "processed").scalar() or 0
        unprocessed = session.query(func.count(Email.id)).filter(Email.processing_status == "unprocessed").scalar() or 0
        failed = session.query(func.count(Email.id)).filter(Email.processing_status == "failed").scalar() or 0

    return jsonify({
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
        },
    })


@bp.get("/<int:email_id>")
def get_email(email_id: int):
    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is None:
            return jsonify({"error": "not found"}), 404
        offers_count = session.query(func.count(Offer.id)).filter(Offer.email_id == email_id).scalar() or 0
        brand = (
            session.query(Offer.brand)
            .filter(Offer.email_id == email_id, Offer.brand.isnot(None))
            .limit(1)
            .scalar()
        )
        return jsonify(_email_detail(e, offers_count, brand))


@bp.delete("/<int:email_id>")
def delete_email(email_id: int):
    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is None:
            return jsonify({"error": "not found"}), 404
        session.delete(e)
    return jsonify({"status": "deleted"})


@bp.post("/<int:email_id>/process")
def process_email_endpoint(email_id: int):
    """Analyse a single email now — used for both the first attempt on an
    unprocessed email and for "Reprocess" on a failed or already-processed
    one. Synchronous (one email, not a bulk job) so the UI gets an immediate
    result; bulk processing still goes through the process_pending job —
    this mirrors that job's OCR + sender-aware analysis + offer replacement
    so the two paths behave identically."""
    from ai.analyzer import analyze_email, build_offer
    from ai.ocr import extract_and_merge

    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is None:
            return jsonify({"error": "not found"}), 404
        subject, body, sender = e.subject, e.body or "", e.sender or ""
        image_urls = json.loads(e.image_urls) if e.image_urls else []

    ocr_result = extract_and_merge(subject, body, image_urls)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is not None:
            e.ocr_text_raw = ocr_result["ocr_raw"] or None
            e.ocr_text_clean = ocr_result["ocr_clean"] or None
            e.ocr_processed_at = now

    result = analyze_email(subject, ocr_result["merged"], sender)

    if result is None:
        with get_session() as session:
            e = session.query(Email).filter(Email.id == email_id).first()
            if e is not None:
                e.processing_status = "failed"
                e.processing_error = "AI returned no result"
                e.processing_attempted_at = now
        return jsonify({"processing_status": "failed", "processing_error": "AI returned no result"})

    with get_session() as session:
        # Reprocessing replaces this email's offer(s) rather than piling up
        # duplicates alongside a stale/wrong one from a previous attempt.
        session.query(Offer).filter(Offer.email_id == email_id).delete()
        session.add(build_offer(email_id, result))
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is not None:
            e.processing_status = "processed"
            e.processing_error = None
            e.processing_attempted_at = now

    return jsonify({"processing_status": "processed", "processing_error": None})


@bp.post("/<int:email_id>/verify")
def verify_email_endpoint(email_id: int):
    from ai.verifier import verify_email_content

    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is None:
            return jsonify({"error": "not found"}), 404
        sender, subject, body = e.sender, e.subject, e.body

    result = verify_email_content(sender, subject, body)
    if result is None:
        return jsonify({"error": "verification failed"}), 502

    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        e.email_verification_status = result["status"]
        e.email_verification_note = result["reason"]
        e.email_verified_at = datetime.now(timezone.utc).replace(tzinfo=None)

    return jsonify(result)


def _run_verify_all():
    from ai.verifier import verify_email_content

    with get_session() as session:
        pending_ids = [
            e.id for e in session.query(Email.id).filter(Email.email_verification_status.is_(None)).all()
        ]

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


@bp.post("/verify-all")
def verify_all_emails():
    if _verify_all_state["running"]:
        return jsonify({"status": "already_running"}), 409
    threading.Thread(target=_run_verify_all, daemon=True).start()
    return jsonify({"status": "started"}), 202


@bp.get("/verify-all/status")
def verify_all_status():
    return jsonify(_verify_all_state)
