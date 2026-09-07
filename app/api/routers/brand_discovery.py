"""Brand Discovery endpoints — search-by-name / scan-website entry points,
the review/edit screen backing a BrandDiscovery row, and the final
create-or-merge-into-Brand save step. See services/brand_discovery/ for the
actual scraping/extraction/duplicate-detection logic and
services/jobs/brand_discovery.py for the background job that runs it."""
import json
import threading
from datetime import datetime, timezone

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse

from database.db import get_session
from database.models import Brand, BrandDiscovery, BrandRequest
from services import job_runner, job_service

router = APIRouter(prefix="/api/brand-discovery", tags=["brand_discovery"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _discovery_to_dict(row: BrandDiscovery) -> dict:
    return {
        "id": row.id,
        "mode": row.mode,
        "query": row.query,
        "status": row.status,
        "job_id": row.job_id,
        "brand_request_id": row.brand_request_id,
        "name": row.name,
        "website": row.website,
        "logo_url": row.logo_url,
        "description": row.description,
        "category": row.category,
        "subcategory": row.subcategory,
        "country": row.country,
        "field_sources": json.loads(row.field_sources) if row.field_sources else {},
        "social_links": json.loads(row.social_links) if row.social_links else {},
        "confidence": row.confidence,
        "duplicate_brand_id": row.duplicate_brand_id,
        "duplicate_score": row.duplicate_score,
        "duplicate_reason": row.duplicate_reason,
        "error": row.error,
        "resolved_brand_id": row.resolved_brand_id,
        "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


@router.post("/search-candidates")
def search_candidates(body: dict = Body(default={})):
    """Method 1's synchronous first step — free DuckDuckGo search only, no
    job/DB row created yet (nothing is worth persisting until the admin
    actually picks a candidate to discover further)."""
    from services.brand_discovery.official_site_finder import search_candidates as run_search

    brand_name = ((body or {}).get("brand_name") or "").strip()
    if not brand_name:
        return JSONResponse({"error": "brand_name is required"}, status_code=400)

    return {"candidates": run_search(brand_name)}


@router.post("/start")
def start_discovery(body: dict = Body(default={})):
    """Creates the BrandDiscovery row + a brand_discovery Job, and starts it
    in a background thread — mirrors app/api/routers/jobs.py's generic
    dispatch, just pre-seeded with the row this job type needs."""
    body = body or {}
    mode = body.get("mode")
    website = (body.get("website") or "").strip()
    seed_name = (body.get("seed_name") or "").strip() or None
    brand_request_id = body.get("brand_request_id")

    if mode not in ("search_name", "scan_website"):
        return JSONResponse({"error": "mode must be 'search_name' or 'scan_website'"}, status_code=400)
    if not website:
        return JSONResponse({"error": "website is required"}, status_code=400)

    with get_session() as session:
        if brand_request_id is not None and session.query(BrandRequest).filter(BrandRequest.id == brand_request_id).first() is None:
            return JSONResponse({"error": "brand_request_id not found"}, status_code=404)
        row = BrandDiscovery(
            mode=mode, query=seed_name or website, status="pending", website=website, name=seed_name,
            brand_request_id=brand_request_id,
        )
        session.add(row)
        session.flush()
        discovery_id = row.id

    job = job_service.create_job("brand_discovery", payload={"discovery_id": discovery_id})

    with get_session() as session:
        row = session.query(BrandDiscovery).filter(BrandDiscovery.id == discovery_id).first()
        if row is not None:
            row.job_id = job["id"]

    config = job_runner.get_runner("brand_discovery")
    threading.Thread(target=config.run, args=(job["id"], job["payload"]), daemon=True).start()

    return JSONResponse({"discoveryId": discovery_id, "jobId": job["id"]}, status_code=202)


@router.get("")
def list_discoveries():
    with get_session() as session:
        rows = (
            session.query(BrandDiscovery)
            .order_by(BrandDiscovery.created_at.desc())
            .limit(50)
            .all()
        )
        return {"discoveries": [_discovery_to_dict(r) for r in rows]}


@router.get("/{discovery_id}")
def get_discovery(discovery_id: int):
    with get_session() as session:
        row = session.query(BrandDiscovery).filter(BrandDiscovery.id == discovery_id).first()
        if row is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        result = _discovery_to_dict(row)
        if row.duplicate_brand_id:
            dup = session.query(Brand).filter(Brand.id == row.duplicate_brand_id).first()
            result["duplicate_brand"] = {"id": dup.id, "name": dup.name, "website": dup.website} if dup else None
        return result


@router.put("/{discovery_id}")
def update_discovery(discovery_id: int, body: dict = Body(default={})):
    body = body or {}
    with get_session() as session:
        row = session.query(BrandDiscovery).filter(BrandDiscovery.id == discovery_id).first()
        if row is None:
            return JSONResponse({"error": "not found"}, status_code=404)

        field_sources = json.loads(row.field_sources) if row.field_sources else {}
        for field in ("name", "website", "logo_url", "description", "category", "subcategory", "country"):
            if field not in body:
                continue
            raw = body[field]
            new_value = (raw.strip() or None) if isinstance(raw, str) else raw
            if new_value != getattr(row, field):
                field_sources[field] = "manual_entry"
            setattr(row, field, new_value)
        row.field_sources = json.dumps(field_sources)

        if "social_links" in body:
            existing_social = json.loads(row.social_links) if row.social_links else {}
            merged = {}
            for platform, entry in (body["social_links"] or {}).items():
                if not isinstance(entry, dict) or not (entry.get("url") or "").strip():
                    continue
                url = entry["url"].strip()
                old_entry = existing_social.get(platform)
                source = old_entry.get("source", "manual_entry") if old_entry and old_entry.get("url") == url else "manual_entry"
                verified = bool(entry.get("verified", old_entry.get("verified", False) if old_entry else False))
                merged[platform] = {"url": url, "source": source, "verified": verified}
            row.social_links = json.dumps(merged)

        row.updated_at = _utcnow()
        return _discovery_to_dict(row)


@router.post("/{discovery_id}/save")
def save_discovery(discovery_id: int, body: dict = Body(default={})):
    body = body or {}
    action = body.get("action", "create")
    target_brand_id = body.get("target_brand_id")

    with get_session() as session:
        row = session.query(BrandDiscovery).filter(BrandDiscovery.id == discovery_id).first()
        if row is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        if not row.name:
            return JSONResponse({"error": "brand name is required before saving"}, status_code=400)

        social_links = json.loads(row.social_links) if row.social_links else {}
        flat_social = {platform: entry["url"] for platform, entry in social_links.items() if entry.get("url")}
        categories = [c for c in (row.category, row.subcategory) if c]

        if action == "merge":
            if not target_brand_id:
                return JSONResponse({"error": "target_brand_id is required for merge"}, status_code=400)
            brand = session.query(Brand).filter(Brand.id == target_brand_id).first()
            if brand is None:
                return JSONResponse({"error": "target brand not found"}, status_code=404)

            # Fill only what's empty — never overwrite curated data on an existing brand.
            brand.website = brand.website or row.website
            brand.logo_url = brand.logo_url or row.logo_url
            brand.description = brand.description or row.description
            brand.country = brand.country or row.country
            existing_categories = json.loads(brand.categories) if brand.categories else []
            if not existing_categories:
                brand.categories = json.dumps(categories)
            existing_social = json.loads(brand.social_links) if brand.social_links else {}
            for platform, url in flat_social.items():
                existing_social.setdefault(platform, url)
            brand.social_links = json.dumps(existing_social) if existing_social else brand.social_links
        elif action == "create":
            if session.query(Brand).filter(Brand.name == row.name).first() is not None:
                return JSONResponse(
                    {"error": f"a brand named {row.name!r} already exists — use merge instead"}, status_code=409
                )
            brand = Brand(
                name=row.name,
                website=row.website,
                categories=json.dumps(categories),
                logo_url=row.logo_url,
                description=row.description,
                country=row.country,
                social_links=json.dumps(flat_social) if flat_social else None,
                is_active=True,
            )
            session.add(brand)
            session.flush()
        else:
            return JSONResponse({"error": "action must be 'create' or 'merge'"}, status_code=400)

        row.status = "saved"
        row.resolved_brand_id = brand.id
        row.resolved_at = _utcnow()

        if row.brand_request_id is not None:
            request = session.query(BrandRequest).filter(BrandRequest.id == row.brand_request_id).first()
            if request is not None:
                request.status = "added"
                request.resolved_at = _utcnow()

        return {"brand_id": brand.id, "brand_name": brand.name}


@router.delete("/{discovery_id}")
def discard_discovery(discovery_id: int):
    with get_session() as session:
        row = session.query(BrandDiscovery).filter(BrandDiscovery.id == discovery_id).first()
        if row is None:
            return JSONResponse({"error": "not found"}, status_code=404)
        row.status = "discarded"
    return {"status": "discarded"}
