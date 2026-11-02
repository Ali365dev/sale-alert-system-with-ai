"""Scraping Schedule CRUD — per-brand automatic scraping schedules using
standard 5-field cron expressions. The APScheduler integration is in
job_registry.py (scraper_server); this router only manages the schedule rows."""
import json
from datetime import datetime, timezone

from croniter import croniter
from fastapi import APIRouter, Body, Depends, Query
from fastapi.responses import JSONResponse

from core.security import require_admin
from database.db import get_session
from database.models import Brand, ScraperConfig, ScrapingSchedule

router = APIRouter(
    prefix="/api/schedules",
    tags=["schedules"],
    dependencies=[Depends(require_admin)],
)


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _next_run(cron_expr: str, base: datetime | None = None) -> datetime | None:
    try:
        it = croniter(cron_expr, base or datetime.utcnow())
        return it.get_next(datetime)
    except Exception:
        return None


def _schedule_to_dict(s: ScrapingSchedule) -> dict:
    return {
        "id": s.id,
        "brand_id": s.brand_id,
        "config_id": s.config_id,
        "name": s.name,
        "cron_expr": s.cron_expr,
        "timezone": s.timezone,
        "enabled": s.enabled,
        "last_run_at": s.last_run_at.isoformat() if s.last_run_at else None,
        "last_job_id": s.last_job_id,
        "next_run_at": s.next_run_at.isoformat() if s.next_run_at else None,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("")
def list_schedules(brand_id: int | None = Query(None), enabled_only: bool = Query(False)):
    with get_session() as session:
        q = session.query(ScrapingSchedule)
        if brand_id is not None:
            q = q.filter(ScrapingSchedule.brand_id == brand_id)
        if enabled_only:
            q = q.filter(ScrapingSchedule.enabled.is_(True))
        schedules = q.order_by(ScrapingSchedule.next_run_at.asc().nullslast()).all()
        return {"schedules": [_schedule_to_dict(s) for s in schedules]}


@router.post("")
def create_schedule(body: dict = Body(...)):
    name = (body.get("name") or "").strip()
    brand_id = body.get("brand_id")
    cron_expr = (body.get("cron_expr") or "").strip()

    if not name:
        return JSONResponse({"error": "name is required"}, status_code=400)
    if not brand_id:
        return JSONResponse({"error": "brand_id is required"}, status_code=400)
    if not cron_expr:
        return JSONResponse({"error": "cron_expr is required"}, status_code=400)
    if not croniter.is_valid(cron_expr):
        return JSONResponse({"error": "invalid cron expression"}, status_code=400)

    with get_session() as session:
        if not session.query(Brand).filter(Brand.id == brand_id).first():
            return JSONResponse({"error": "brand not found"}, status_code=404)

        config_id = body.get("config_id")
        if config_id is not None:
            if not session.query(ScraperConfig).filter(ScraperConfig.id == config_id).first():
                return JSONResponse({"error": "scraper config not found"}, status_code=404)

        next_run = _next_run(cron_expr)
        schedule = ScrapingSchedule(
            brand_id=brand_id,
            config_id=config_id,
            name=name,
            cron_expr=cron_expr,
            timezone=body.get("timezone", "UTC"),
            enabled=bool(body.get("enabled", True)),
            next_run_at=next_run,
        )
        session.add(schedule)
        session.flush()
        return JSONResponse(_schedule_to_dict(schedule), status_code=201)


@router.get("/{schedule_id}")
def get_schedule(schedule_id: int):
    with get_session() as session:
        s = session.query(ScrapingSchedule).filter(ScrapingSchedule.id == schedule_id).first()
        if not s:
            return JSONResponse({"error": "not found"}, status_code=404)
        return _schedule_to_dict(s)


@router.put("/{schedule_id}")
def update_schedule(schedule_id: int, body: dict = Body(...)):
    with get_session() as session:
        s = session.query(ScrapingSchedule).filter(ScrapingSchedule.id == schedule_id).first()
        if not s:
            return JSONResponse({"error": "not found"}, status_code=404)

        if "name" in body:
            s.name = (body["name"] or "").strip()
        if "cron_expr" in body:
            cron_expr = (body["cron_expr"] or "").strip()
            if not croniter.is_valid(cron_expr):
                return JSONResponse({"error": "invalid cron expression"}, status_code=400)
            s.cron_expr = cron_expr
            s.next_run_at = _next_run(cron_expr)
        if "timezone" in body:
            s.timezone = body["timezone"] or "UTC"
        if "enabled" in body:
            s.enabled = bool(body["enabled"])
            if s.enabled and not s.next_run_at:
                s.next_run_at = _next_run(s.cron_expr)
        if "config_id" in body:
            s.config_id = body["config_id"]

        session.flush()
        return _schedule_to_dict(s)


@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: int):
    with get_session() as session:
        s = session.query(ScrapingSchedule).filter(ScrapingSchedule.id == schedule_id).first()
        if not s:
            return JSONResponse({"error": "not found"}, status_code=404)
        session.delete(s)
    return {"status": "deleted"}


@router.post("/{schedule_id}/run-now")
def run_schedule_now(schedule_id: int):
    """Trigger the schedule's scrape job immediately (outside its cron cadence)."""
    from services import job_service
    from services.website_scraper.dispatch import reclaim_and_dispatch

    with get_session() as session:
        s = session.query(ScrapingSchedule).filter(ScrapingSchedule.id == schedule_id).first()
        if not s:
            return JSONResponse({"error": "not found"}, status_code=404)
        payload: dict = {"brand_id": s.brand_id}
        if s.config_id:
            payload["scraper_config_id"] = s.config_id

    job = job_service.create_job("website_scrape_brand", payload=payload)
    reclaim_and_dispatch()
    return JSONResponse({"jobId": job["id"], "status": "started"}, status_code=202)
