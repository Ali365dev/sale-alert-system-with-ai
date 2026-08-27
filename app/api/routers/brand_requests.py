"""Brand requests — a user-initiated "we don't track this brand yet" signal,
the mirror of BrandCandidate (system/AI-detected). Public create endpoint
(called by the app); admin list/resolve endpoints for the review queue."""
from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse

from app.core.security import require_admin
from database.db import get_session
from database.models import BrandRequest, _utcnow

router = APIRouter(prefix="/api/brand-requests", tags=["brand-requests"])


def _request_to_dict(r: BrandRequest) -> dict:
    return {
        "id": r.id,
        "device_id": r.device_id,
        "brand_name": r.brand_name,
        "category": r.category,
        "note": r.note,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "resolved_at": r.resolved_at.isoformat() if r.resolved_at else None,
    }


# ── Public (called by the app) ─────────────────────────────────────────────

@router.post("")
def create_brand_request(body: dict = Body(default={})):
    body = body or {}
    brand_name = (body.get("brand_name") or "").strip()
    if not brand_name:
        return JSONResponse({"error": "brand_name is required"}, status_code=400)

    with get_session() as session:
        r = BrandRequest(
            device_id=(body.get("device_id") or "").strip() or None,
            brand_name=brand_name,
            category=(body.get("category") or "").strip() or None,
            note=(body.get("note") or "").strip() or None,
        )
        session.add(r)
        session.flush()
        return JSONResponse(_request_to_dict(r), status_code=201)


# ── Admin (review queue) ────────────────────────────────────────────────────

@router.get("", dependencies=[Depends(require_admin)])
def list_brand_requests(status: str | None = Query(None)):
    with get_session() as session:
        q = session.query(BrandRequest)
        if status:
            q = q.filter(BrandRequest.status == status)
        requests = q.order_by(BrandRequest.created_at.desc()).all()
        return {"requests": [_request_to_dict(r) for r in requests]}


@router.put("/{request_id}", dependencies=[Depends(require_admin)])
def update_brand_request(request_id: int, body: dict = Body(default={})):
    body = body or {}
    status = body.get("status")
    if status not in ("pending", "added", "rejected"):
        return JSONResponse({"error": "status must be 'pending', 'added', or 'rejected'"}, status_code=400)

    with get_session() as session:
        r = session.query(BrandRequest).filter(BrandRequest.id == request_id).first()
        if r is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        r.status = status
        r.resolved_at = _utcnow() if status != "pending" else None
        session.flush()
        return _request_to_dict(r)
