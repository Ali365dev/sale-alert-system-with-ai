"""FastAPI entry point — served via `uvicorn app.main:app` (see Dockerfile).
Replaced the old Flask app (api_server.py + api/) after every router was
migrated and verified against it.

Startup sequence (init_db, job_registry.register_all, start_scheduler) is
the same as the old Flask create_app() — same calls, same order, so
background jobs/scheduling behave identically."""
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.security import AdminAuthError
from app.core.user_security import UserAuthError
from config import logger
from database.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    from services.job_registry import register_all
    register_all()

    from services.scheduler import start_scheduler
    start_scheduler()

    logger.info("FastAPI app started")
    yield


app = FastAPI(title="Sales Alert System API", version="1.0.0", lifespan=lifespan)

# Same origin policy as the Flask app (api/__init__.py::create_app) — a
# concrete regex for local dev plus explicit extra origins from
# ADDITIONAL_CORS_ORIGINS, never "*", since /api/settings uses a credentialed
# (httpOnly cookie) session and browsers reject wildcard-origin + credentials
# together.
_extra_origins = [o.strip() for o in os.getenv("ADDITIONAL_CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_origins=_extra_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AdminAuthError)
def admin_auth_error_handler(request: Request, exc: AdminAuthError):
    return JSONResponse({"error": "not authenticated"}, status_code=401)


@app.exception_handler(UserAuthError)
def user_auth_error_handler(request: Request, exc: UserAuthError):
    return JSONResponse({"error": "not authenticated"}, status_code=401)


@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "ok"}


from app.api.routers import (  # noqa: E402
    analytics, auth, automation, brand_requests, brands, emails, insights, jobs, notifications, offers, overview,
    preferences, search, settings, unknown_emails,
)

app.include_router(auth.router)
app.include_router(overview.router)
app.include_router(analytics.router)
app.include_router(insights.router)
app.include_router(search.router)
app.include_router(offers.router)
app.include_router(brands.router)
app.include_router(brand_requests.router)
app.include_router(emails.router)
app.include_router(unknown_emails.router)
app.include_router(jobs.router)
app.include_router(notifications.router)
app.include_router(preferences.router)
app.include_router(settings.router)
app.include_router(settings.admin_router)
app.include_router(automation.router)
app.include_router(automation.admin_router)
