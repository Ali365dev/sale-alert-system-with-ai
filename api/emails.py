"""Email manager endpoints — list raw fetched emails and classify them via AI."""
import json
import threading
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import exists, func

from database.db import get_session
from database.models import Email, Offer

bp = Blueprint("emails", __name__, url_prefix="/api/emails")

_verify_all_state = {"running": False, "done": 0, "total": 0, "failed": 0}


def _image_count(e: Email) -> int:
    try:
        return len(json.loads(e.image_urls)) if e.image_urls else 0
    except (json.JSONDecodeError, TypeError):
        return 0


def _email_summary(e: Email, offers_count: int) -> dict:
    return {
        "id": e.id,
        "sender": e.sender,
        "subject": e.subject,
        "received_date": e.received_date.isoformat() if e.received_date else None,
        "processed_at": e.processed_at.isoformat() if e.processed_at else None,
        "status": e.email_verification_status,
        "note": e.email_verification_note,
        "verified_at": e.email_verified_at.isoformat() if e.email_verified_at else None,
        "offers_count": offers_count,
        "image_count": _image_count(e),
    }


def _email_detail(e: Email, offers_count: int) -> dict:
    try:
        image_urls = json.loads(e.image_urls) if e.image_urls else []
    except (json.JSONDecodeError, TypeError):
        image_urls = []
    return {**_email_summary(e, offers_count), "body": e.body, "image_urls": image_urls}


@bp.get("")
def list_emails():
    status = request.args.get("status")

    with get_session() as session:
        counts = dict(
            session.query(Offer.email_id, func.count(Offer.id)).group_by(Offer.email_id).all()
        )
        q = session.query(Email).order_by(Email.id.desc())
        if status == "unverified":
            q = q.filter(Email.email_verification_status.is_(None))
        elif status:
            q = q.filter(Email.email_verification_status == status)
        emails = q.all()

        rows = [_email_summary(e, counts.get(e.id, 0)) for e in emails]

        total = session.query(func.count(Email.id)).scalar() or 0
        legitimate = session.query(func.count(Email.id)).filter(Email.email_verification_status == "legitimate").scalar() or 0
        suspicious = session.query(func.count(Email.id)).filter(Email.email_verification_status == "suspicious").scalar() or 0
        spam = session.query(func.count(Email.id)).filter(Email.email_verification_status == "spam").scalar() or 0
        unverified = max(total - legitimate - suspicious - spam, 0)
        unprocessed = (
            session.query(func.count(Email.id))
            .filter(~exists().where(Offer.email_id == Email.id))
            .scalar()
            or 0
        )

    return jsonify({
        "emails": rows,
        "summary": {
            "total": total,
            "unverified": unverified,
            "unprocessed": unprocessed,
            "legitimate": legitimate,
            "suspicious": suspicious,
            "spam": spam,
        },
    })


@bp.get("/<int:email_id>")
def get_email(email_id: int):
    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is None:
            return jsonify({"error": "not found"}), 404
        offers_count = session.query(func.count(Offer.id)).filter(Offer.email_id == email_id).scalar() or 0
        return jsonify(_email_detail(e, offers_count))


@bp.delete("/<int:email_id>")
def delete_email(email_id: int):
    with get_session() as session:
        e = session.query(Email).filter(Email.id == email_id).first()
        if e is None:
            return jsonify({"error": "not found"}), 404
        session.delete(e)
    return jsonify({"status": "deleted"})


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
