"""Offers manager endpoints — list/filter, CRUD, and AI verification."""
import json
import threading
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from database.db import get_session
from database.models import Offer

bp = Blueprint("offers", __name__, url_prefix="/api/offers")

_verify_all_state = {"running": False, "done": 0, "total": 0, "failed": 0}


def _offer_to_dict(o: Offer) -> dict:
    return {
        "id": o.id,
        "email_id": o.email_id,
        "brand": o.brand,
        "company": o.company,
        "category": o.category,
        "subcategory": o.subcategory,
        "offer_type": o.offer_type,
        "discount_percentage": o.discount_percentage,
        "coupon_code": o.coupon_code,
        "expiry_date": o.expiry_date.isoformat() if o.expiry_date else None,
        "offer_value": o.offer_value,
        "website": o.website,
        "summary": o.summary,
        "key_highlights": json.loads(o.key_highlights) if o.key_highlights else [],
        "is_active": o.is_active,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "verification_status": o.verification_status,
        "verification_reason": o.verification_reason,
        "verification_confidence": o.verification_confidence,
        "verified_at": o.verified_at.isoformat() if o.verified_at else None,
    }


def _parse_expiry(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


@bp.get("")
def list_offers():
    brand = request.args.get("brand")
    category = request.args.get("category")
    subcategory = request.args.get("subcategory")
    offer_type = request.args.get("offer_type")
    verification_status = request.args.get("verification_status")
    active = request.args.get("active")

    with get_session() as session:
        q = session.query(Offer)
        if brand:
            q = q.filter(Offer.brand == brand)
        if category:
            q = q.filter(Offer.category == category)
        if subcategory:
            q = q.filter(Offer.subcategory == subcategory)
        if offer_type:
            q = q.filter(Offer.offer_type == offer_type)
        if verification_status == "unverified":
            q = q.filter(Offer.verification_status.is_(None))
        elif verification_status:
            q = q.filter(Offer.verification_status == verification_status)
        if active == "true":
            q = q.filter(Offer.is_active.is_(True))
        elif active == "false":
            q = q.filter(Offer.is_active.is_(False))

        offers = q.order_by(Offer.id.desc()).all()

        # Summary always reflects the full table, not the current filters —
        # matches the Email Manager pattern of stable, unfiltered headline counts.
        total = session.query(func.count(Offer.id)).scalar() or 0
        verified = session.query(func.count(Offer.id)).filter(Offer.verification_status == "verified").scalar() or 0
        suspicious = session.query(func.count(Offer.id)).filter(Offer.verification_status == "suspicious").scalar() or 0
        invalid = session.query(func.count(Offer.id)).filter(Offer.verification_status == "invalid").scalar() or 0
        active_count = session.query(func.count(Offer.id)).filter(Offer.is_active.is_(True)).scalar() or 0
        unverified = max(total - verified - suspicious - invalid, 0)

        offer_dicts = [_offer_to_dict(o) for o in offers]

    return jsonify({
        "offers": offer_dicts,
        "summary": {
            "total": total,
            "verified": verified,
            "suspicious": suspicious,
            "invalid": invalid,
            "unverified": unverified,
            "active": active_count,
        },
    })


@bp.get("/<int:offer_id>")
def get_offer(offer_id: int):
    with get_session() as session:
        o = session.query(Offer).filter(Offer.id == offer_id).first()
        if o is None:
            return jsonify({"error": "not found"}), 404
        return jsonify(_offer_to_dict(o))


@bp.post("")
def create_offer():
    body = request.get_json(force=True)
    with get_session() as session:
        offer = Offer(
            email_id=body.get("email_id"),
            brand=body.get("brand") or None,
            company=body.get("company") or None,
            category=body.get("category") or None,
            subcategory=body.get("subcategory") or None,
            offer_type=body.get("offer_type") or None,
            discount_percentage=body.get("discount_percentage"),
            coupon_code=body.get("coupon_code") or None,
            expiry_date=_parse_expiry(body.get("expiry_date")),
            offer_value=body.get("offer_value") or None,
            website=body.get("website") or None,
            summary=body.get("summary") or None,
            key_highlights=json.dumps(body.get("key_highlights", [])),
            is_active=bool(body.get("is_active", True)),
            source="manual",
        )
        session.add(offer)
        session.flush()
        return jsonify(_offer_to_dict(offer)), 201


@bp.put("/<int:offer_id>")
def update_offer(offer_id: int):
    body = request.get_json(force=True)
    with get_session() as session:
        o = session.query(Offer).filter(Offer.id == offer_id).first()
        if o is None:
            return jsonify({"error": "not found"}), 404

        for field in ("brand", "company", "category", "subcategory", "offer_type",
                      "discount_percentage", "coupon_code", "offer_value", "website", "summary"):
            if field in body:
                setattr(o, field, body[field] or None)
        if "expiry_date" in body:
            o.expiry_date = _parse_expiry(body["expiry_date"])
        if "key_highlights" in body:
            o.key_highlights = json.dumps(body["key_highlights"])
        if "is_active" in body:
            o.is_active = bool(body["is_active"])
        if "verification_status" in body:
            status = body["verification_status"] or None
            if status not in (None, "verified", "suspicious", "invalid"):
                return jsonify({"error": "invalid verification_status"}), 400
            o.verification_status = status
            o.verification_reason = "Manually set" if status else None
            o.verification_confidence = 100.0 if status else None
            o.verified_at = datetime.now(timezone.utc).replace(tzinfo=None) if status else None

        session.flush()
        return jsonify(_offer_to_dict(o))


@bp.delete("/<int:offer_id>")
def delete_offer(offer_id: int):
    with get_session() as session:
        o = session.query(Offer).filter(Offer.id == offer_id).first()
        if o is None:
            return jsonify({"error": "not found"}), 404
        session.delete(o)
    return jsonify({"status": "deleted"})


@bp.post("/<int:offer_id>/verify")
def verify_offer_endpoint(offer_id: int):
    from ai.verifier import verify_offer

    with get_session() as session:
        o = session.query(Offer).filter(Offer.id == offer_id).first()
        if o is None:
            return jsonify({"error": "not found"}), 404
        offer_data = _offer_to_dict(o)

    result = verify_offer(offer_data)
    if result is None:
        return jsonify({"error": "verification failed"}), 502

    with get_session() as session:
        o = session.query(Offer).filter(Offer.id == offer_id).first()
        o.verification_status = result["status"]
        o.verification_reason = result["reason"]
        o.verification_confidence = float(result["confidence"])
        o.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)

    return jsonify(result)


def _run_verify_all():
    from ai.verifier import verify_offer

    with get_session() as session:
        unverified_ids = [
            o.id for o in session.query(Offer.id).filter(Offer.verification_status.is_(None)).all()
        ]

    _verify_all_state.update({"running": True, "done": 0, "total": len(unverified_ids), "failed": 0})
    for offer_id in unverified_ids:
        try:
            with get_session() as session:
                o = session.query(Offer).filter(Offer.id == offer_id).first()
                if o is None:
                    continue
                offer_data = _offer_to_dict(o)

            result = verify_offer(offer_data)
            if result:
                with get_session() as session:
                    o = session.query(Offer).filter(Offer.id == offer_id).first()
                    if o:
                        o.verification_status = result["status"]
                        o.verification_reason = result["reason"]
                        o.verification_confidence = float(result["confidence"])
                        o.verified_at = datetime.now(timezone.utc).replace(tzinfo=None)
            else:
                _verify_all_state["failed"] += 1
        except Exception:
            _verify_all_state["failed"] += 1
        finally:
            _verify_all_state["done"] += 1

    _verify_all_state["running"] = False


@bp.post("/verify-all")
def verify_all_offers():
    if _verify_all_state["running"]:
        return jsonify({"status": "already_running"}), 409
    threading.Thread(target=_run_verify_all, daemon=True).start()
    return jsonify({"status": "started"}), 202


@bp.get("/verify-all/status")
def verify_all_status():
    return jsonify(_verify_all_state)
