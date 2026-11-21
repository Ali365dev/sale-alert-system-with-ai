"""Brand requests — the app's "we don't track this brand yet" form. Only the
public create endpoint lives here; the admin review queue (list/resolve) is
on scraper_server (routers/brand_requests.py)."""
from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from database.db import get_session
from database.models import BrandRequest

router = APIRouter(prefix="/api/brand-requests", tags=["brand-requests"])


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
        return JSONResponse(
            {
                "id": r.id,
                "device_id": r.device_id,
                "brand_name": r.brand_name,
                "category": r.category,
                "note": r.note,
                "status": r.status,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "resolved_at": None,
            },
            status_code=201,
        )
