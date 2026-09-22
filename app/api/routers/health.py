"""Unauthenticated liveness probe — no DB, jobs, Gmail, AI, or scraping.

Render uses GET /api/health as `healthCheckPath`. An *external* scheduler
(not this process) can GET it on an interval to keep a Free-plan service
from spinning down. Keep this handler trivial; do not add a self-ping here.
"""
from fastapi import APIRouter

router = APIRouter(tags=["health"])


@router.get("/health")
@router.get("/api/health")
def health():
    return {"status": "ok"}
