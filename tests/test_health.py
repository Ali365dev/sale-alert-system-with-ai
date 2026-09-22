"""GET /api/health — unauthenticated liveness probe.

The handler is mounted on a standalone FastAPI app containing only this
router — not the real app.main:app — so tests never trigger the real
lifespan (which calls database.db.init_db() against the live DB) and never
import the rest of the router package (some modules query the DB at
import time)."""
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routers.health import router


def make_test_app() -> FastAPI:
    app = FastAPI()
    app.include_router(router)
    return app


def test_health_returns_ok_json():
    client = TestClient(make_test_app())
    resp = client.get("/api/health")

    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/json")
    assert resp.json()["status"] == "ok"
