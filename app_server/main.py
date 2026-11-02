"""App Server — mobile app / user-facing backend.

Handles all user-facing functionality:
  auth / brands / categories / offers / preferences /
  sale_alerts / overview / search

Background scheduler runs here:
  - Gmail polling / email automation
  - Offer cleanup (daily)
  - Sale alert checks (every 6h)

Run:
    uvicorn app_server.main:app --host 0.0.0.0 --port 8000 --workers 1
"""
import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager

# Shared code lives one level up — add it to the import path so all
# `from config import ...`, `from database import ...`, etc. still resolve.
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.security import AdminAuthError
from core.user_security import UserAuthError
from config import logger
from database.db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()

    from app_server.job_registry import register_app_jobs
    register_app_jobs()

    from services.offer_notifications import register_hooks
    register_hooks()

    from services.scheduler import start_scheduler
    start_scheduler()

    from services.keep_alive import start_keep_alive
    start_keep_alive()

    logger.info("App server started")
    yield


app = FastAPI(title="Sales Alert — App Server", version="1.0.0", lifespan=lifespan)

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


@app.exception_handler(UserAuthError)
def user_auth_error_handler(request: Request, exc: UserAuthError):
    return JSONResponse({"error": "not authenticated"}, status_code=401)


from routers.health import router as health_router  # noqa: E402
from routers import (  # noqa: E402
    auth,
    brands,
    categories,
    offers,
    overview,
    preferences,
    sale_alerts,
    search,
)

app.include_router(health_router)
app.include_router(auth.router)
app.include_router(overview.router)
app.include_router(search.router)
app.include_router(offers.router)
app.include_router(brands.router)
app.include_router(categories.router)
app.include_router(preferences.router)
app.include_router(sale_alerts.router)
