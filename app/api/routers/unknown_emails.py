"""Unknown Emails / Brand Discovery endpoints — review queue for emails the
pipeline couldn't match to a known brand's sender domain. Ported from
api/unknown_emails.py — logic and response shape unchanged.

Bulk/single "Analyze" still has no bespoke route here — it reuses the
existing generic job-start route, POST /api/jobs/discover_brand_candidates/start."""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import func, or_

from app.api.dependencies import Pagination, pagination
from database.db import get_session
from database.models import Brand, BrandCandidate, Email

router = APIRouter(prefix="/api/unknown-emails", tags=["unknown_emails"])

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


@router.get("")
def list_candidates(
    status: str | None = Query(None),
    q: str | None = Query(None),
    sort: str = Query("created_at"),
    sort_dir: str = Query("desc"),
    page_params: Pagination = Depends(pagination),
):
    search = (q or "").strip()
    page, page_size = page_params.page, page_params.page_size

    sort_col = _SORT_COLUMNS.get(sort, BrandCandidate.created_at)
    order = sort_col.asc() if sort_dir == "asc" else sort_col.desc()

    with get_session() as session:
        cq = session.query(BrandCandidate, Email).join(Email, BrandCandidate.email_id == Email.id)

        if status in _STATUSES:
            cq = cq.filter(BrandCandidate.status == status)

        if search:
            like = f"%{search}%"
            cq = cq.filter(
                or_(
                    Email.sender.ilike(like),
                    Email.subject.ilike(like),
                    BrandCandidate.suggested_name.ilike(like),
                    BrandCandidate.sender_domain.ilike(like),
                )
            )

        total = cq.count()
        rows = cq.order_by(order).offset(page_params.offset).limit(page_size).all()
        candidates = [_candidate_to_dict(c, e) for c, e in rows]

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

    return {"candidates": candidates, "total": total, "page": page, "page_size": page_size, "summary": summary}


@router.get("/{candidate_id}")
def get_candidate(candidate_id: int):
    with get_session() as session:
        row = (
            session.query(BrandCandidate, Email)
            .join(Email, BrandCandidate.email_id == Email.id)
            .filter(BrandCandidate.id == candidate_id)
            .first()
        )
        if row is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        c, e = row
        return _candidate_detail(c, e)


@router.post("/{candidate_id}/ignore")
def ignore_candidate(candidate_id: int):
    with get_session() as session:
        c = session.query(BrandCandidate).filter(BrandCandidate.id == candidate_id).first()
        if c is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        c.status = "ignored"
        session.flush()
        e = session.query(Email).filter(Email.id == c.email_id).first()
        return _candidate_to_dict(c, e)


@router.delete("/{candidate_id}")
def delete_candidate(candidate_id: int):
    """Removes the candidate row from the review queue only — the underlying
    Email is never touched, so nothing is lost, and re-running the pipeline
    on that email would just route it back here again."""
    with get_session() as session:
        c = session.query(BrandCandidate).filter(BrandCandidate.id == candidate_id).first()
        if c is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        session.delete(c)
    return {"status": "deleted"}


@router.post("/bulk")
def bulk_action(body: dict = Body(default={})):
    body = body or {}
    action = body.get("action")
    ids = body.get("ids") or []
    if action == "ignore":
        with get_session() as session:
            count = (
                session.query(BrandCandidate)
                .filter(BrandCandidate.id.in_(ids))
                .update({"status": "ignored"}, synchronize_session=False)
            )
        return {"status": "ignored", "count": count}
    if action == "delete":
        with get_session() as session:
            count = (
                session.query(BrandCandidate)
                .filter(BrandCandidate.id.in_(ids))
                .delete(synchronize_session=False)
            )
        return {"status": "deleted", "count": count}
    return JSONResponse({"error": f"unknown bulk action {action!r}"}, status_code=400)


@router.post("/{candidate_id}/add-brand")
def add_brand_from_candidate(candidate_id: int, body: dict = Body(...)):
    from services.email_processing import reprocess_email

    link_existing_brand_id = body.get("link_existing_brand_id")

    with get_session() as session:
        c = session.query(BrandCandidate).filter(BrandCandidate.id == candidate_id).first()
        if c is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        sender_domain = c.sender_domain
        email_id = c.email_id

    with get_session() as session:
        if link_existing_brand_id:
            brand = session.query(Brand).filter(Brand.id == link_existing_brand_id).first()
            if brand is None:
                return JSONResponse({"error": "existing brand not found"}, status_code=404)
        else:
            name = (body.get("name") or "").strip()
            if not name:
                return JSONResponse({"error": "name is required"}, status_code=400)
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

    # Admin just deliberately resolved this candidate to a brand — bypass the
    # sale-content filter, same reasoning as the manual Process/Reprocess button.
    reprocess_result = reprocess_email(email_id, apply_sale_filter=False)

    with get_session() as session:
        row = (
            session.query(BrandCandidate, Email)
            .join(Email, BrandCandidate.email_id == Email.id)
            .filter(BrandCandidate.id == candidate_id)
            .first()
        )
        c, e = row
        candidate_dict = _candidate_to_dict(c, e)

    return {
        "brand": brand_dict,
        "candidate": candidate_dict,
        "reprocessed": reprocess_result["processing_status"] == "processed",
        "reprocess_result": reprocess_result,
    }
