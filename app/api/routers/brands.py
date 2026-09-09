"""Brands manager endpoints — CRUD plus single/bulk AI offer search. Ported
from api/brands.py — logic, response shape, and the fire-and-forget
threading.Thread + module-level dict polling pattern are unchanged (see
migration plan: preserved as-is, not converted to a queue, since it depends
on the deployment staying single-process — already true today)."""
import json
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from database.db import get_session
from database.models import Brand, Offer

router = APIRouter(prefix="/api/brands", tags=["brands"])

_bulk_search_state = {"running": False, "done": 0, "total": 0, "offers_found": 0, "offers_saved": 0}
_single_search_state: dict[int, dict] = {}


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
        "logo_url": b.logo_url,
        "description": b.description,
        "country": b.country,
        "social_links": json.loads(b.social_links) if b.social_links else {},
        "homepage_url": b.homepage_url,
        "sale_page_url": b.sale_page_url,
        "offers_page_url": b.offers_page_url,
        "promotions_page_url": b.promotions_page_url,
        "custom_scrape_urls": json.loads(b.custom_scrape_urls) if b.custom_scrape_urls else [],
        "website_scraping_enabled": b.website_scraping_enabled,
    }


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


@router.get("")
def list_brands():
    with get_session() as session:
        brands = session.query(Brand).order_by(Brand.name.asc()).all()
        rows = [_brand_to_dict(b) for b in brands]

    return {
        "brands": rows,
        "summary": {
            "total": len(rows),
            "active": sum(1 for b in rows if b["is_active"]),
            "ever_searched": sum(1 for b in rows if b["last_searched"]),
            "known_sender_emails": sum(len(b["emails"]) for b in rows),
        },
    }


@router.post("")
def create_brand(body: dict = Body(...)):
    name = (body.get("name") or "").strip()
    if not name:
        return JSONResponse({"error": "name is required"}, status_code=400)

    with get_session() as session:
        brand = Brand(
            name=name,
            website=(body.get("website") or "").strip() or None,
            categories=json.dumps(body.get("categories", [])),
            emails=json.dumps(body.get("emails", [])) if body.get("emails") else None,
            is_active=bool(body.get("is_active", True)),
            logo_url=(body.get("logo_url") or "").strip() or None,
            description=(body.get("description") or "").strip() or None,
            country=(body.get("country") or "").strip() or None,
            social_links=json.dumps(body.get("social_links")) if body.get("social_links") else None,
            homepage_url=(body.get("homepage_url") or "").strip() or None,
            sale_page_url=(body.get("sale_page_url") or "").strip() or None,
            offers_page_url=(body.get("offers_page_url") or "").strip() or None,
            promotions_page_url=(body.get("promotions_page_url") or "").strip() or None,
            custom_scrape_urls=json.dumps(body.get("custom_scrape_urls")) if body.get("custom_scrape_urls") else None,
            website_scraping_enabled=bool(body.get("website_scraping_enabled", True)),
        )
        session.add(brand)
        session.flush()
        return JSONResponse(_brand_to_dict(brand), status_code=201)


@router.put("/{brand_id}")
def update_brand(brand_id: int, body: dict = Body(...)):
    with get_session() as session:
        b = session.query(Brand).filter(Brand.id == brand_id).first()
        if b is None:
            return JSONResponse({"error": "not found"}, status_code=404)

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
        if "logo_url" in body:
            b.logo_url = (body["logo_url"] or "").strip() or None
        if "description" in body:
            b.description = (body["description"] or "").strip() or None
        if "country" in body:
            b.country = (body["country"] or "").strip() or None
        if "social_links" in body:
            b.social_links = json.dumps(body["social_links"]) if body["social_links"] else None
        for field in ("homepage_url", "sale_page_url", "offers_page_url", "promotions_page_url"):
            if field in body:
                setattr(b, field, (body[field] or "").strip() or None)
        if "custom_scrape_urls" in body:
            b.custom_scrape_urls = json.dumps(body["custom_scrape_urls"]) if body["custom_scrape_urls"] else None
        if "website_scraping_enabled" in body:
            b.website_scraping_enabled = bool(body["website_scraping_enabled"])

        session.flush()
        return _brand_to_dict(b)


@router.delete("/{brand_id}")
def delete_brand(brand_id: int):
    with get_session() as session:
        b = session.query(Brand).filter(Brand.id == brand_id).first()
        if b is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        session.delete(b)
    return {"status": "deleted"}


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
