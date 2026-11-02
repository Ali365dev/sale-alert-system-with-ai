"""Scraper Configuration CRUD — admin-defined CSS selector trees for brands.
Each ScraperConfig holds start URLs, crawl limits, and a tree of
ScraperSelectors. The Chrome extension posts new configs here after the
admin uses point-and-click visual selection."""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends
from fastapi.responses import JSONResponse

from core.security import require_admin
from database.db import get_session
from database.models import Brand, ScraperConfig, ScraperSelector

router = APIRouter(
    prefix="/api/scraper-configs",
    tags=["scraper_configs"],
    dependencies=[Depends(require_admin)],
)


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _selector_to_dict(s: ScraperSelector) -> dict:
    return {
        "id": s.id,
        "config_id": s.config_id,
        "parent_id": s.parent_id,
        "name": s.name,
        "selector_type": s.selector_type,
        "css_selector": s.css_selector,
        "attribute": s.attribute,
        "multiple": s.multiple,
        "enabled": s.enabled,
        "sort_order": s.sort_order,
        "extraction_delay": s.extraction_delay,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


def _config_to_dict(c: ScraperConfig, include_selectors: bool = True) -> dict:
    d = {
        "id": c.id,
        "brand_id": c.brand_id,
        "name": c.name,
        "description": c.description,
        "start_urls": json.loads(c.start_urls) if c.start_urls else [],
        "max_pages": c.max_pages,
        "max_depth": c.max_depth,
        "max_links_per_page": c.max_links_per_page,
        "request_delay": c.request_delay,
        "request_timeout": c.request_timeout,
        "max_retries": c.max_retries,
        "enabled": c.enabled,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "updated_at": c.updated_at.isoformat() if c.updated_at else None,
    }
    if include_selectors:
        d["selectors"] = [_selector_to_dict(s) for s in c.selectors]
    return d


# ── Config CRUD ──────────────────────────────────────────────────────────────

@router.get("")
def list_configs(brand_id: int | None = None):
    with get_session() as session:
        q = session.query(ScraperConfig)
        if brand_id is not None:
            q = q.filter(ScraperConfig.brand_id == brand_id)
        configs = q.order_by(ScraperConfig.created_at.desc()).all()
        return {"configs": [_config_to_dict(c, include_selectors=False) for c in configs]}


@router.post("")
def create_config(body: dict = Body(...)):
    name = (body.get("name") or "").strip()
    if not name:
        return JSONResponse({"error": "name is required"}, status_code=400)

    brand_id = body.get("brand_id")
    if brand_id is not None:
        with get_session() as session:
            if not session.query(Brand).filter(Brand.id == brand_id).first():
                return JSONResponse({"error": "brand not found"}, status_code=404)

    with get_session() as session:
        config = ScraperConfig(
            brand_id=brand_id,
            name=name,
            description=(body.get("description") or "").strip() or None,
            start_urls=json.dumps(body.get("start_urls", [])),
            max_pages=int(body.get("max_pages", 20)),
            max_depth=int(body.get("max_depth", 3)),
            max_links_per_page=int(body.get("max_links_per_page", 50)),
            request_delay=float(body.get("request_delay", 1.5)),
            request_timeout=int(body.get("request_timeout", 30)),
            max_retries=int(body.get("max_retries", 2)),
            enabled=bool(body.get("enabled", True)),
        )
        session.add(config)
        session.flush()

        # Optionally bulk-insert selectors from extension payload
        selectors_data = body.get("selectors", [])
        for i, sd in enumerate(selectors_data):
            sel = ScraperSelector(
                config_id=config.id,
                parent_id=sd.get("parent_id"),
                name=(sd.get("name") or "").strip() or f"Selector {i+1}",
                selector_type=sd.get("selector_type", "text"),
                css_selector=sd.get("css_selector", ""),
                attribute=sd.get("attribute"),
                multiple=bool(sd.get("multiple", False)),
                enabled=bool(sd.get("enabled", True)),
                sort_order=sd.get("sort_order", i),
                extraction_delay=sd.get("extraction_delay"),
            )
            session.add(sel)
        session.flush()

        return JSONResponse(_config_to_dict(config), status_code=201)


@router.get("/{config_id}")
def get_config(config_id: int):
    with get_session() as session:
        c = session.query(ScraperConfig).filter(ScraperConfig.id == config_id).first()
        if not c:
            return JSONResponse({"error": "not found"}, status_code=404)
        return _config_to_dict(c)


@router.put("/{config_id}")
def update_config(config_id: int, body: dict = Body(...)):
    with get_session() as session:
        c = session.query(ScraperConfig).filter(ScraperConfig.id == config_id).first()
        if not c:
            return JSONResponse({"error": "not found"}, status_code=404)

        for field in ("name", "description"):
            if field in body:
                setattr(c, field, (body[field] or "").strip() or None)
        if "start_urls" in body:
            c.start_urls = json.dumps(body["start_urls"])
        for field in ("max_pages", "max_depth", "max_links_per_page", "request_timeout", "max_retries"):
            if field in body:
                setattr(c, field, int(body[field]))
        if "request_delay" in body:
            c.request_delay = float(body["request_delay"])
        if "enabled" in body:
            c.enabled = bool(body["enabled"])

        session.flush()
        return _config_to_dict(c)


@router.delete("/{config_id}")
def delete_config(config_id: int):
    with get_session() as session:
        c = session.query(ScraperConfig).filter(ScraperConfig.id == config_id).first()
        if not c:
            return JSONResponse({"error": "not found"}, status_code=404)
        session.delete(c)
    return {"status": "deleted"}


# ── Run a config via existing website_scraper job ────────────────────────────

@router.post("/{config_id}/run")
def run_config(config_id: int):
    from services import job_service
    from services.website_scraper.dispatch import reclaim_and_dispatch

    with get_session() as session:
        c = session.query(ScraperConfig).filter(ScraperConfig.id == config_id).first()
        if not c:
            return JSONResponse({"error": "not found"}, status_code=404)
        payload = {
            "brand_id": c.brand_id,
            "scraper_config_id": c.id,
            "start_urls": json.loads(c.start_urls) if c.start_urls else [],
        }

    job = job_service.create_job("website_scrape_brand", payload=payload)
    reclaim_and_dispatch()
    return JSONResponse({"jobId": job["id"], "status": "started"}, status_code=202)


# ── Selector CRUD ────────────────────────────────────────────────────────────

@router.get("/{config_id}/selectors")
def list_selectors(config_id: int):
    with get_session() as session:
        c = session.query(ScraperConfig).filter(ScraperConfig.id == config_id).first()
        if not c:
            return JSONResponse({"error": "not found"}, status_code=404)
        selectors = (
            session.query(ScraperSelector)
            .filter(ScraperSelector.config_id == config_id)
            .order_by(ScraperSelector.sort_order)
            .all()
        )
        return {"selectors": [_selector_to_dict(s) for s in selectors]}


@router.post("/{config_id}/selectors")
def create_selector(config_id: int, body: dict = Body(...)):
    with get_session() as session:
        c = session.query(ScraperConfig).filter(ScraperConfig.id == config_id).first()
        if not c:
            return JSONResponse({"error": "not found"}, status_code=404)

        name = (body.get("name") or "").strip()
        if not name:
            return JSONResponse({"error": "name is required"}, status_code=400)

        # Validate parent belongs to same config
        parent_id = body.get("parent_id")
        if parent_id is not None:
            parent = session.query(ScraperSelector).filter(
                ScraperSelector.id == parent_id,
                ScraperSelector.config_id == config_id,
            ).first()
            if not parent:
                return JSONResponse({"error": "parent selector not found in this config"}, status_code=400)

        sel = ScraperSelector(
            config_id=config_id,
            parent_id=parent_id,
            name=name,
            selector_type=body.get("selector_type", "text"),
            css_selector=body.get("css_selector", ""),
            attribute=body.get("attribute"),
            multiple=bool(body.get("multiple", False)),
            enabled=bool(body.get("enabled", True)),
            sort_order=body.get("sort_order", 0),
            extraction_delay=body.get("extraction_delay"),
        )
        session.add(sel)
        session.flush()
        return JSONResponse(_selector_to_dict(sel), status_code=201)


@router.put("/{config_id}/selectors/{selector_id}")
def update_selector(config_id: int, selector_id: int, body: dict = Body(...)):
    with get_session() as session:
        s = session.query(ScraperSelector).filter(
            ScraperSelector.id == selector_id,
            ScraperSelector.config_id == config_id,
        ).first()
        if not s:
            return JSONResponse({"error": "not found"}, status_code=404)

        for field in ("name", "css_selector", "attribute"):
            if field in body:
                setattr(s, field, body[field] or None if field != "css_selector" else body[field])
        for field in ("selector_type", "sort_order", "extraction_delay"):
            if field in body:
                setattr(s, field, body[field])
        for field in ("multiple", "enabled"):
            if field in body:
                setattr(s, field, bool(body[field]))
        if "parent_id" in body:
            s.parent_id = body["parent_id"]

        session.flush()
        return _selector_to_dict(s)


@router.delete("/{config_id}/selectors/{selector_id}")
def delete_selector(config_id: int, selector_id: int):
    with get_session() as session:
        s = session.query(ScraperSelector).filter(
            ScraperSelector.id == selector_id,
            ScraperSelector.config_id == config_id,
        ).first()
        if not s:
            return JSONResponse({"error": "not found"}, status_code=404)
        session.delete(s)
    return {"status": "deleted"}
