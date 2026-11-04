"""Unauthenticated liveness probe — no DB, jobs, Gmail, AI, or scraping.

Render uses GET /api/health as `healthCheckPath`. An *external* scheduler
(not this process) can GET it on an interval to keep a Free-plan service
from spinning down. Keep this handler trivial; do not add a self-ping here.
"""
import logging

from fastapi import APIRouter, Request
from fastapi.responses import RedirectResponse

logger = logging.getLogger(__name__)
router = APIRouter(tags=["health"])


@router.get("/")
def root():
    """Browser hits to / used to 404; send them to the interactive docs."""
    return RedirectResponse(url="/docs")


@router.get("/health")
@router.get("/api/health")
def health(request: Request):
    caller = request.headers.get("user-agent", "unknown")
    logger.info("scraper_server health hit from %s %s", request.client.host if request.client else "?", caller)
    return {"status": "ok"}
