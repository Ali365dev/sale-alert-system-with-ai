"""Admin-managed category catalog. GET is public (mobile + public site);
mutations require an admin session."""
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import func

from app.core.security import require_admin
from database.db import get_session
from database.models import Brand, Category, Offer

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _category_to_dict(c: Category, *, brand_count: int = 0, offer_count: int = 0) -> dict:
    return {
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "is_active": c.is_active,
        "sort_order": c.sort_order,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "brand_count": brand_count,
        "offer_count": offer_count,
    }


def _counts_by_name(session) -> tuple[dict[str, int], dict[str, int]]:
    offer_rows = (
        session.query(Offer.category, func.count(Offer.id))
        .filter(Offer.category.isnot(None), Offer.category != "")
        .group_by(Offer.category)
        .all()
    )
    offer_counts = {name: count for name, count in offer_rows if name}

    brand_counts: dict[str, int] = {}
    for brand in session.query(Brand).all():
        try:
            import json

            names = json.loads(brand.categories) if brand.categories else []
        except Exception:
            names = []
        for name in names:
            if not name:
                continue
            brand_counts[name] = brand_counts.get(name, 0) + 1

    return brand_counts, offer_counts


@router.get("")
def list_categories(include_inactive: bool = Query(False)):
    with get_session() as session:
        q = session.query(Category)
        if not include_inactive:
            q = q.filter(Category.is_active.is_(True))
        rows = q.order_by(Category.sort_order.asc(), Category.name.asc()).all()
        brand_counts, offer_counts = _counts_by_name(session)
        return {
            "categories": [
                _category_to_dict(
                    c,
                    brand_count=brand_counts.get(c.name, 0),
                    offer_count=offer_counts.get(c.name, 0),
                )
                for c in rows
            ]
        }


@router.post("", dependencies=[Depends(require_admin)])
def create_category(body: dict = Body(...)):
    name = (body.get("name") or "").strip()
    if not name:
        return JSONResponse({"error": "name is required"}, status_code=400)

    with get_session() as session:
        existing = session.query(Category).filter(func.lower(Category.name) == name.lower()).first()
        if existing:
            return JSONResponse({"error": "a category with that name already exists"}, status_code=409)

        max_order = session.query(func.max(Category.sort_order)).scalar()
        sort_order = body.get("sort_order")
        try:
            sort_order = int(sort_order) if sort_order is not None else int(max_order or 0) + 10
        except (TypeError, ValueError):
            sort_order = int(max_order or 0) + 10

        category = Category(
            name=name,
            description=(body.get("description") or "").strip() or None,
            is_active=bool(body.get("is_active", True)),
            sort_order=sort_order,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        session.add(category)
        session.flush()
        return JSONResponse(_category_to_dict(category), status_code=201)


@router.put("/{category_id}", dependencies=[Depends(require_admin)])
def update_category(category_id: int, body: dict = Body(...)):
    with get_session() as session:
        c = session.query(Category).filter(Category.id == category_id).first()
        if c is None:
            return JSONResponse({"error": "not found"}, status_code=404)

        if "name" in body:
            name = (body.get("name") or "").strip()
            if not name:
                return JSONResponse({"error": "name is required"}, status_code=400)
            dup = (
                session.query(Category)
                .filter(func.lower(Category.name) == name.lower(), Category.id != category_id)
                .first()
            )
            if dup:
                return JSONResponse({"error": "a category with that name already exists"}, status_code=409)
            c.name = name
        if "description" in body:
            c.description = (body.get("description") or "").strip() or None
        if "is_active" in body:
            c.is_active = bool(body["is_active"])
        if "sort_order" in body:
            try:
                c.sort_order = int(body["sort_order"])
            except (TypeError, ValueError):
                return JSONResponse({"error": "sort_order must be an integer"}, status_code=400)

        session.flush()
        brand_counts, offer_counts = _counts_by_name(session)
        return _category_to_dict(
            c,
            brand_count=brand_counts.get(c.name, 0),
            offer_count=offer_counts.get(c.name, 0),
        )


@router.delete("/{category_id}", dependencies=[Depends(require_admin)])
def delete_category(category_id: int):
    with get_session() as session:
        c = session.query(Category).filter(Category.id == category_id).first()
        if c is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        session.delete(c)
    return {"status": "deleted"}
