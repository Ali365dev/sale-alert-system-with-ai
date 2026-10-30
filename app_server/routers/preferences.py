"""Per-device interest preferences (brands/categories chosen during onboarding).
Public — called by the app itself, keyed by a client-generated device_id (not
the FCM push token, so preferences work even without push permission)."""
import json

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse

from database.db import get_session
from database.models import UserProfile

router = APIRouter(prefix="/api/preferences", tags=["preferences"])


def _profile_to_dict(p: UserProfile) -> dict:
    return {
        "device_id": p.device_id,
        "brands": json.loads(p.brands) if p.brands else [],
        "categories": json.loads(p.categories) if p.categories else [],
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }


@router.get("")
def get_preferences(device_id: str = Query(...)):
    device_id = (device_id or "").strip()
    if not device_id:
        return JSONResponse({"error": "device_id is required"}, status_code=400)

    with get_session() as session:
        p = session.query(UserProfile).filter(UserProfile.device_id == device_id).first()
        if p is None:
            return {"device_id": device_id, "brands": [], "categories": [], "updated_at": None}
        return _profile_to_dict(p)


@router.put("")
def save_preferences(body: dict = Body(default={})):
    body = body or {}
    device_id = (body.get("device_id") or "").strip()
    if not device_id:
        return JSONResponse({"error": "device_id is required"}, status_code=400)

    has_brands = "brands" in body
    has_categories = "categories" in body
    brands = body.get("brands") or []
    categories = body.get("categories") or []
    if (has_brands and not isinstance(brands, list)) or (has_categories and not isinstance(categories, list)):
        return JSONResponse({"error": "brands and categories must be arrays"}, status_code=400)

    with get_session() as session:
        p = session.query(UserProfile).filter(UserProfile.device_id == device_id).first()
        if p is None:
            p = UserProfile(device_id=device_id, brands=json.dumps([]), categories=json.dumps([]))
            session.add(p)
        # Only touch the fields the caller actually sent — e.g. the profile
        # screen only edits categories and must not wipe out saved brands.
        if has_brands:
            p.brands = json.dumps(brands)
        if has_categories:
            p.categories = json.dumps(categories)
        session.flush()
        return _profile_to_dict(p)
