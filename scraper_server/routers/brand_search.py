"""Admin "AI offer search" for brands — single-brand and bulk. Moved from
app_server (pure CRUD) because it runs fetch_offers_for_brand on a
background thread. Offers saved here go through this server's own
after_commit hook (services/offer_notifications.py) for notifications.

Uses a module-level dict for polling state, so it relies on this server
staying single-process (uvicorn --workers 1)."""
import json
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends
from fastapi.responses import JSONResponse

from core.security import require_admin
from database.db import get_session
from database.models import Brand, Offer

router = APIRouter(prefix="/api/brands", tags=["brand-search"], dependencies=[Depends(require_admin)])

_bulk_search_state = {"running": False, "done": 0, "total": 0, "offers_found": 0, "offers_saved": 0}
_single_search_state: dict[int, dict] = {}


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


def _run_single_search(brand_id: int, brand_dict: dict) -> None:
    from ai.brand_fetcher import fetch_offers_for_brand

    try:
        offers_data = fetch_offers_for_brand(brand_dict, cache=None) or []
        saved, failed = _save_offers(offers_data)

        with get_session() as session:
            b = session.query(Brand).filter(Brand.id == brand_id).first()
            if b:
                b.last_searched = datetime.now(timezone.utc).replace(tzinfo=None)

        active = sum(1 for o in offers_data if o.get("_is_sale"))
        _single_search_state[brand_id] = {
            "running": False,
            "error": None,
            "result": {
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
            },
        }
    except Exception as exc:
        _single_search_state[brand_id] = {"running": False, "error": str(exc), "result": None}


@router.post("/{brand_id}/search")
def search_brand(brand_id: int):
    if _single_search_state.get(brand_id, {}).get("running"):
        return JSONResponse({"status": "already_running"}, status_code=409)

    with get_session() as session:
        b = session.query(Brand).filter(Brand.id == brand_id).first()
        if b is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        brand_dict = {
            "name": b.name,
            "website": b.website,
            "categories": json.loads(b.categories) if b.categories else [],
        }

    _single_search_state[brand_id] = {"running": True, "error": None, "result": None}
    threading.Thread(target=_run_single_search, args=(brand_id, brand_dict), daemon=True).start()
    return JSONResponse({"status": "started"}, status_code=202)


@router.get("/{brand_id}/search/status")
def search_brand_status(brand_id: int):
    return _single_search_state.get(brand_id, {"running": False, "error": None, "result": None})


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


@router.post("/bulk-search")
def bulk_search(body: dict = Body(default={})):
    if _bulk_search_state["running"]:
        return JSONResponse({"status": "already_running"}, status_code=409)
    skip_cache = bool((body or {}).get("skip_cache", False))
    threading.Thread(target=_run_bulk_search, args=(skip_cache,), daemon=True).start()
    return JSONResponse({"status": "started"}, status_code=202)


@router.get("/bulk-search/status")
def bulk_search_status():
    return _bulk_search_state
