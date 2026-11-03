"""Scraper Server — admin dashboard backend + all scraping/research.

Handles all admin-facing functionality:
  analytics / insights / jobs / notifications / automation /
  settings / brand_requests / emails / unknown_emails /
  website_scraper / social_scraper / brand_discovery

All jobs here are API-triggered (no background scheduler). The scraper server
is stateless beyond the shared database — safe to scale or redeploy independently.

Run:
    uvicorn scraper_server.main:app --host 0.0.0.0 --port 8001 --workers 1
"""
import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager

# Shared code lives one level up.
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.security import AdminAuthError
from config import logger
from database.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    from job_registry import register_scraper_jobs
    register_scraper_jobs()

    # Any website-scrape jobs left in running/pending state when this
    # process last died have no worker — free those slots so scrape-now works.
    try:
        from services.website_scraper.dispatch import fail_orphaned_on_startup
        fail_orphaned_on_startup()
    except Exception:
        logger.exception("Failed to reclaim orphaned website scrape jobs on startup")

    from services.keep_alive import start_keep_alive
    start_keep_alive()

    logger.info("Scraper server started")
    yield


app = FastAPI(title="Sales Alert — Scraper Server", version="1.0.0", lifespan=lifespan)

_extra_origins = [o.strip() for o in os.getenv("ADDITIONAL_CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+|chrome-extension://.*",
    allow_origins=_extra_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AdminAuthError)
def admin_auth_error_handler(request: Request, exc: AdminAuthError):
    return JSONResponse({"error": "not authenticated"}, status_code=401)


from routers.health import router as health_router  # noqa: E402
from routers import (  # noqa: E402
    analytics,
    automation,
    brand_discovery,
    brand_requests,
    emails,
    insights,
    jobs,
    notifications,
    schedules,
    scraper_configs,
    settings,
    social_scraper,
    unknown_emails,
    website_scraper,
)

app.include_router(health_router)
# Admin — data / config
app.include_router(analytics.router)
app.include_router(insights.router)
app.include_router(jobs.router)
app.include_router(notifications.router)
app.include_router(automation.router)
app.include_router(automation.admin_router)
app.include_router(settings.router)
app.include_router(settings.admin_router)
app.include_router(brand_requests.router)
app.include_router(emails.router)
app.include_router(unknown_emails.router)
# Admin — scraping / research
app.include_router(website_scraper.router)
app.include_router(social_scraper.router)
app.include_router(brand_discovery.router)
app.include_router(scraper_configs.router)
app.include_router(schedules.router)
