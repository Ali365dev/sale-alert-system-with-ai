"""Brands manager endpoints — CRUD plus single/bulk AI offer search."""
import json
import threading
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from database.db import get_session
from database.models import Brand, Offer

bp = Blueprint("brands", __name__, url_prefix="/api/brands")

_bulk_search_state = {"running": False, "done": 0, "total": 0, "offers_found": 0, "offers_saved": 0}


def _brand_to_dict(b: Brand) -> dict:
    return {
        "id": b.id,
        "name": b.name,
        "website": b.website,
        "categories": json.loads(b.categories) if b.categories else [],
        "emails": json.loads(b.emails) if b.emails else [],
        "is_active": b.is_active,
        "last_searched": b.last_searched.isoformat() if b.last_searched else None,
        "created_at": b.created_at.isoformat() if b.created_at else None,
    }


def _parse_emails(raw: str) -> list[str]:
    parts = [p.strip().lower() for p in raw.replace("\n", ",").split(",")]
    return sorted({p for p in parts if p})


def _save_offers(offers_data: list[dict]) -> tuple[int, int]:
    saved, failed = 0, 0
    for o_data in offers_data:
        try:
            offer = Offer(
                email_id=None,
                brand=o_data.get("brand"),
                company=o_data.get("company"),
                category=o_data.get("category"),
                subcategory=o_data.get("subcategory"),
                offer_type=o_data.get("offer_type"),
                discount_percentage=o_data.get("discount_percentage"),
                coupon_code=o_data.get("coupon_code"),
                expiry_date=o_data.get("expiry_date"),
                offer_value=o_data.get("offer_value"),
                website=o_data.get("website") or o_data.get("_url") or None,
                summary=o_data.get("summary"),
                key_highlights=o_data.get("key_highlights"),
                is_active=bool(o_data.get("is_active", False)),
                source="ai",
            )
            with get_session() as session:
                session.add(offer)
            saved += 1
        except Exception:
            failed += 1
    return saved, failed


@bp.get("")
def list_brands():
    with get_session() as session:
        brands = session.query(Brand).order_by(Brand.name.asc()).all()
        rows = [_brand_to_dict(b) for b in brands]

    return jsonify({
        "brands": rows,
        "summary": {
            "total": len(rows),
            "active": sum(1 for b in rows if b["is_active"]),
            "ever_searched": sum(1 for b in rows if b["last_searched"]),
            "known_sender_emails": sum(len(b["emails"]) for b in rows),
        },
    })


@bp.post("")
def create_brand():
    body = request.get_json(force=True)
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400

    with get_session() as session:
        brand = Brand(
            name=name,
            website=(body.get("website") or "").strip() or None,
            categories=json.dumps(body.get("categories", [])),
            emails=json.dumps(body.get("emails", [])) if body.get("emails") else None,
            is_active=bool(body.get("is_active", True)),
        )
        session.add(brand)
        session.flush()
        return jsonify(_brand_to_dict(brand)), 201


@bp.put("/<int:brand_id>")
def update_brand(brand_id: int):
    body = request.get_json(force=True)
    with get_session() as session:
        b = session.query(Brand).filter(Brand.id == brand_id).first()
        if b is None:
            return jsonify({"error": "not found"}), 404

        if "name" in body:
            b.name = body["name"].strip()
        if "website" in body:
            b.website = (body["website"] or "").strip() or None
        if "categories" in body:
            b.categories = json.dumps(body["categories"])
        if "emails" in body:
            b.emails = json.dumps(body["emails"]) if body["emails"] else None
        if "is_active" in body:
            b.is_active = bool(body["is_active"])

        session.flush()
        return jsonify(_brand_to_dict(b))


@bp.delete("/<int:brand_id>")
def delete_brand(brand_id: int):
    with get_session() as session:
        b = session.query(Brand).filter(Brand.id == brand_id).first()
        if b is None:
            return jsonify({"error": "not found"}), 404
        session.delete(b)
    return jsonify({"status": "deleted"})


@bp.post("/<int:brand_id>/search")
def search_brand(brand_id: int):
    from ai.brand_fetcher import fetch_offers_for_brand

    with get_session() as session:
        b = session.query(Brand).filter(Brand.id == brand_id).first()
        if b is None:
            return jsonify({"error": "not found"}), 404
        brand_dict = {
            "name": b.name,
            "website": b.website,
            "categories": json.loads(b.categories) if b.categories else [],
        }

    offers_data = fetch_offers_for_brand(brand_dict, cache=None) or []
    saved, failed = _save_offers(offers_data)

    with get_session() as session:
        b = session.query(Brand).filter(Brand.id == brand_id).first()
        b.last_searched = datetime.now(timezone.utc).replace(tzinfo=None)

    active = sum(1 for o in offers_data if o.get("_is_sale"))
    return jsonify({
        "found": len(offers_data),
        "active": active,
        "saved": saved,
        "failed": failed,
        "preview": [
            {
                "offer_type": o.get("offer_type"),
                "discount_percentage": o.get("discount_percentage"),
                "coupon_code": o.get("coupon_code"),
                "summary": (o.get("summary") or "")[:120],
            }
            for o in offers_data
        ],
    })


def _run_bulk_search(skip_cache: bool):
    from ai import cache as _cache
    from ai.brand_fetcher import fetch_offers_for_brand

    with get_session() as session:
        active_brands = session.query(Brand).filter(Brand.is_active.is_(True)).all()
        brand_snapshots = [
            {"id": b.id, "name": b.name, "website": b.website, "categories": b.categories}
            for b in active_brands
        ]

    _bulk_search_state.update({
        "running": True, "done": 0, "total": len(brand_snapshots), "offers_found": 0, "offers_saved": 0,
    })

    cache = None if skip_cache else _cache.load()
    for snap in brand_snapshots:
        try:
            brand_dict = {
                "name": snap["name"],
                "website": snap["website"],
                "categories": json.loads(snap["categories"]) if snap["categories"] else [],
            }
            offers = fetch_offers_for_brand(brand_dict, cache=cache) or []
            if offers:
                saved, _ = _save_offers(offers)
                _bulk_search_state["offers_found"] += len(offers)
                _bulk_search_state["offers_saved"] += saved
            with get_session() as session:
                b = session.query(Brand).filter(Brand.id == snap["id"]).first()
                if b:
                    b.last_searched = datetime.now(timezone.utc).replace(tzinfo=None)
        except Exception:
            pass
        finally:
            _bulk_search_state["done"] += 1

    if cache is not None:
        _cache.save(cache)
    _bulk_search_state["running"] = False


@bp.post("/bulk-search")
def bulk_search():
    if _bulk_search_state["running"]:
        return jsonify({"status": "already_running"}), 409
    body = request.get_json(silent=True) or {}
    skip_cache = bool(body.get("skip_cache", False))
    threading.Thread(target=_run_bulk_search, args=(skip_cache,), daemon=True).start()
    return jsonify({"status": "started"}), 202


@bp.get("/bulk-search/status")
def bulk_search_status():
    return jsonify(_bulk_search_state)
