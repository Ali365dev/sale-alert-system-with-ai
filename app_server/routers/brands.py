"""Brands manager CRUD. The AI offer search (single + bulk) runs on
scraper_server — see scraper_server/routers/brand_search.py."""
import json

from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse

from api.logo_display import apply_logo_body, logo_fields_from_brand
from core.security import require_admin
from database.db import get_session
from database.models import Brand

router = APIRouter(prefix="/api/brands", tags=["brands"])

# Normalise free-text country names (from AI discovery) to 2-letter ISO codes.
_COUNTRY_ISO: dict[str, str] = {
    "pakistan": "PK", "saudi arabia": "SA", "ksa": "SA",
    "united arab emirates": "AE", "uae": "AE", "dubai": "AE",
    "egypt": "EG", "qatar": "QA", "kuwait": "KW", "oman": "OM", "bahrain": "BH",
    "united states": "US", "usa": "US", "united states of america": "US",
    "united kingdom": "GB", "uk": "GB", "turkey": "TR", "türkiye": "TR",
    "india": "IN", "singapore": "SG",
}

def _iso_country(raw: str | None) -> str | None:
    if not raw:
        return None
    stripped = raw.strip()
    if len(stripped) == 2:
        return stripped.upper()
    return _COUNTRY_ISO.get(stripped.lower(), stripped)


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
        **logo_fields_from_brand(b),
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


@router.get("")
def list_brands(region: str | None = Query(default=None)):
    with get_session() as session:
        q = session.query(Brand)
        if region:
            # Include brands tagged for this country, brands with no country,
            # or brands explicitly marked "INTL" (all show in every region).
            q = q.filter(
                (Brand.country == region.upper()) | Brand.country.is_(None) | (Brand.country == "INTL")
            )
        brands = q.order_by(Brand.name.asc()).all()
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


@router.post("", dependencies=[Depends(require_admin)])
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
            country=_iso_country(body.get("country")),
            social_links=json.dumps(body.get("social_links")) if body.get("social_links") else None,
            homepage_url=(body.get("homepage_url") or "").strip() or None,
            sale_page_url=(body.get("sale_page_url") or "").strip() or None,
            offers_page_url=(body.get("offers_page_url") or "").strip() or None,
            promotions_page_url=(body.get("promotions_page_url") or "").strip() or None,
            custom_scrape_urls=json.dumps(body.get("custom_scrape_urls")) if body.get("custom_scrape_urls") else None,
            website_scraping_enabled=bool(body.get("website_scraping_enabled", True)),
        )
        apply_logo_body(brand, body)
        session.add(brand)
        session.flush()
        return JSONResponse(_brand_to_dict(brand), status_code=201)


@router.put("/{brand_id}", dependencies=[Depends(require_admin)])
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
        if "description" in body:
            b.description = (body["description"] or "").strip() or None
        if "country" in body:
            b.country = _iso_country(body.get("country"))
        if "social_links" in body:
            b.social_links = json.dumps(body["social_links"]) if body["social_links"] else None
        for field in ("homepage_url", "sale_page_url", "offers_page_url", "promotions_page_url"):
            if field in body:
                setattr(b, field, (body[field] or "").strip() or None)
        if "custom_scrape_urls" in body:
            b.custom_scrape_urls = json.dumps(body["custom_scrape_urls"]) if body["custom_scrape_urls"] else None
        if "website_scraping_enabled" in body:
            b.website_scraping_enabled = bool(body["website_scraping_enabled"])

        apply_logo_body(b, body, reset=bool(body.get("reset_logo_transform")))

        session.flush()
        return _brand_to_dict(b)


@router.put("/{brand_id}/logo", dependencies=[Depends(require_admin)])
def update_brand_logo(brand_id: int, body: dict = Body(...)):
    """Dedicated logo transform endpoint — same fields as PUT /brands/{id}."""
    with get_session() as session:
        b = session.query(Brand).filter(Brand.id == brand_id).first()
        if b is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        apply_logo_body(b, body, reset=bool(body.get("reset_logo_transform")))
        session.flush()
        return _brand_to_dict(b)


@router.delete("/{brand_id}", dependencies=[Depends(require_admin)])
def delete_brand(brand_id: int):
    with get_session() as session:
        b = session.query(Brand).filter(Brand.id == brand_id).first()
        if b is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        session.delete(b)
    return {"status": "deleted"}
