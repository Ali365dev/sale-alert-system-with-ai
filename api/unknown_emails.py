"""Unknown Emails / Brand Discovery endpoints — review queue for emails the
pipeline couldn't match to a known brand's sender domain (see
services/jobs/discover_brand.py and services/jobs/process_pending.py).

Bulk/single "Analyze" deliberately has no bespoke route here — it reuses the
existing generic job-start route, POST /api/jobs/discover_brand_candidates/start
with {"candidate_ids": [...]} (or {} for "all pending"), so there's exactly
one progress-polling mechanism in the app rather than a second one just for
this feature."""
import json
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import func, or_

from database.db import get_session
from database.models import Brand, BrandCandidate, Email

bp = Blueprint("unknown_emails", __name__, url_prefix="/api/unknown-emails")

_PAGE_SIZES = (10, 25, 50, 100)
_STATUSES = ("pending", "analyzed", "resolved", "ignored")
_SORT_COLUMNS = {
    "created_at": BrandCandidate.created_at,
    "confidence": BrandCandidate.confidence,
    "status": BrandCandidate.status,
    "id": BrandCandidate.id,
}


def _candidate_to_dict(c: BrandCandidate, e: Email) -> dict:
    return {
        "id": c.id,
        "email_id": c.email_id,
        "status": c.status,
        "sender": e.sender,
        "sender_domain": c.sender_domain,
        "subject": e.subject,
        "received_date": e.received_date.isoformat() if e.received_date else None,
        "suggestion": {
            "name": c.suggested_name,
            "website": c.suggested_website,
            "category": c.suggested_category,
            "logo_url": c.suggested_logo_url,
            "country": c.suggested_country,
            "socials": json.loads(c.suggested_socials) if c.suggested_socials else {},
            "confidence": c.confidence,
            "reasoning": c.reasoning,
        } if c.status in ("analyzed", "resolved") else None,
        "duplicate": {
            "brand_id": c.possible_duplicate_brand_id,
            "score": c.duplicate_match_score,
            "reason": c.duplicate_match_reason,
        } if c.possible_duplicate_brand_id else None,
        "analysis_error": c.analysis_error,
        "analyzed_at": c.analyzed_at.isoformat() if c.analyzed_at else None,
        "resolved_brand_id": c.resolved_brand_id,
        "resolved_at": c.resolved_at.isoformat() if c.resolved_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _candidate_detail(c: BrandCandidate, e: Email) -> dict:
    try:
        image_urls = json.loads(e.image_urls) if e.image_urls else []
    except (json.JSONDecodeError, TypeError):
        image_urls = []
    return {
        **_candidate_to_dict(c, e),
        "body": e.body,
        "ocr_text_clean": e.ocr_text_clean,
        "image_urls": image_urls,
    }


@bp.get("")
def list_candidates():
    status = request.args.get("status")
    search = (request.args.get("q") or "").strip()
    sort = request.args.get("sort", "created_at")
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

    sort_col = _SORT_COLUMNS.get(sort, BrandCandidate.created_at)
    order = sort_col.asc() if sort_dir == "asc" else sort_col.desc()

    with get_session() as session:
        q = session.query(BrandCandidate, Email).join(Email, BrandCandidate.email_id == Email.id)

        if status in _STATUSES:
            q = q.filter(BrandCandidate.status == status)

        if search:
            like = f"%{search}%"
            q = q.filter(
                or_(
                    Email.sender.ilike(like),
                    Email.subject.ilike(like),
                    BrandCandidate.suggested_name.ilike(like),
                    BrandCandidate.sender_domain.ilike(like),
                )
            )

        total = q.count()
        rows = q.order_by(order).offset((page - 1) * page_size).limit(page_size).all()
        candidates = [_candidate_to_dict(c, e) for c, e in rows]

        # Summary counts always reflect the full table, not the current filters.
        counts = dict(
            session.query(BrandCandidate.status, func.count(BrandCandidate.id)).group_by(BrandCandidate.status).all()
        )
        summary = {
            "total": sum(counts.values()),
            "pending": counts.get("pending", 0),
            "analyzed": counts.get("analyzed", 0),
            "resolved": counts.get("resolved", 0),
            "ignored": counts.get("ignored", 0),
        }

    return jsonify({"candidates": candidates, "total": total, "page": page, "page_size": page_size, "summary": summary})


@bp.get("/<int:candidate_id>")
def get_candidate(candidate_id: int):
    with get_session() as session:
        row = (
            session.query(BrandCandidate, Email)
            .join(Email, BrandCandidate.email_id == Email.id)
            .filter(BrandCandidate.id == candidate_id)
            .first()
        )
        if row is None:
            return jsonify({"error": "not found"}), 404
        c, e = row
        return jsonify(_candidate_detail(c, e))


@bp.post("/<int:candidate_id>/ignore")
def ignore_candidate(candidate_id: int):
    with get_session() as session:
        c = session.query(BrandCandidate).filter(BrandCandidate.id == candidate_id).first()
        if c is None:
            return jsonify({"error": "not found"}), 404
        c.status = "ignored"
        session.flush()
        e = session.query(Email).filter(Email.id == c.email_id).first()
        return jsonify(_candidate_to_dict(c, e))


@bp.delete("/<int:candidate_id>")
def delete_candidate(candidate_id: int):
    """Removes the candidate row from the review queue only — the underlying
    Email is never touched, so nothing is lost, and re-running the pipeline
    on that email would just route it back here again."""
    with get_session() as session:
        c = session.query(BrandCandidate).filter(BrandCandidate.id == candidate_id).first()
        if c is None:
            return jsonify({"error": "not found"}), 404
        session.delete(c)
    return jsonify({"status": "deleted"})


@bp.post("/bulk")
def bulk_action():
    body = request.get_json(silent=True) or {}
    action = body.get("action")
    ids = body.get("ids") or []
    if action == "ignore":
        with get_session() as session:
            count = (
                session.query(BrandCandidate)
                .filter(BrandCandidate.id.in_(ids))
                .update({"status": "ignored"}, synchronize_session=False)
            )
        return jsonify({"status": "ignored", "count": count})
    if action == "delete":
        with get_session() as session:
            count = (
                session.query(BrandCandidate)
                .filter(BrandCandidate.id.in_(ids))
                .delete(synchronize_session=False)
            )
        return jsonify({"status": "deleted", "count": count})
    return jsonify({"error": f"unknown bulk action {action!r}"}), 400


@bp.post("/<int:candidate_id>/add-brand")
def add_brand_from_candidate(candidate_id: int):
    from services.email_processing import reprocess_email

    body = request.get_json(force=True)
    link_existing_brand_id = body.get("link_existing_brand_id")

    with get_session() as session:
        c = session.query(BrandCandidate).filter(BrandCandidate.id == candidate_id).first()
        if c is None:
            return jsonify({"error": "not found"}), 404
        sender_domain = c.sender_domain
        email_id = c.email_id

    with get_session() as session:
        if link_existing_brand_id:
            brand = session.query(Brand).filter(Brand.id == link_existing_brand_id).first()
            if brand is None:
                return jsonify({"error": "existing brand not found"}), 404
        else:
            name = (body.get("name") or "").strip()
            if not name:
                return jsonify({"error": "name is required"}), 400
            brand = Brand(
                name=name,
                website=(body.get("website") or "").strip() or None,
                categories=json.dumps([body["category"]]) if body.get("category") else json.dumps([]),
                logo_url=(body.get("logo_url") or "").strip() or None,
                description=(body.get("description") or "").strip() or None,
                country=(body.get("country") or "").strip() or None,
                social_links=json.dumps(body.get("social_links")) if body.get("social_links") else None,
                is_active=bool(body.get("is_active", True)),
            )
            session.add(brand)
            session.flush()

        # Teach the domain-match gate about this sender so future emails from
        # it (and this reprocess call, right below) match automatically.
        known = set(json.loads(brand.emails)) if brand.emails else set()
        if sender_domain:
            known.add(sender_domain)
        brand.emails = json.dumps(sorted(known))

        brand_id = brand.id
        brand_dict = {
            "id": brand.id, "name": brand.name, "website": brand.website,
            "categories": json.loads(brand.categories) if brand.categories else [],
            "emails": json.loads(brand.emails) if brand.emails else [],
            "is_active": brand.is_active,
            "logo_url": brand.logo_url, "description": brand.description, "country": brand.country,
            "social_links": json.loads(brand.social_links) if brand.social_links else {},
        }

    now = datetime.now(timezone.utc).replace(tzinfo=None)
    with get_session() as session:
        c = session.query(BrandCandidate).filter(BrandCandidate.id == candidate_id).first()
        c.status = "resolved"
        c.resolved_brand_id = brand_id
        c.resolved_at = now
        c.resolved_by = body.get("actor") or "admin"

    reprocess_result = reprocess_email(email_id)

    with get_session() as session:
        row = (
            session.query(BrandCandidate, Email)
            .join(Email, BrandCandidate.email_id == Email.id)
            .filter(BrandCandidate.id == candidate_id)
            .first()
        )
        c, e = row
        candidate_dict = _candidate_to_dict(c, e)

    return jsonify({
        "brand": brand_dict,
        "candidate": candidate_dict,
        "reprocessed": reprocess_result["processing_status"] == "processed",
        "reprocess_result": reprocess_result,
    })
