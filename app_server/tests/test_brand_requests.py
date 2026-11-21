from fastapi import FastAPI
from fastapi.testclient import TestClient

from routers import brand_requests


def test_create_is_served_on_app_server(mocker, mock_get_session, mock_session):
    """Regression: after the split this only existed on scraper_server, so the
    app's "request a brand" form got a 404."""
    mocker.patch.object(brand_requests, "get_session", mock_get_session)
    app = FastAPI()
    app.include_router(brand_requests.router)

    def _flush():
        added = mock_session.add.call_args.args[0]
        added.id, added.status, added.created_at = 1, "pending", None
    mock_session.flush.side_effect = _flush

    r = TestClient(app).post("/api/brand-requests", json={"brand_name": "Khaadi", "device_id": "dev-1"})

    assert r.status_code == 201
    assert r.json()["brand_name"] == "Khaadi"


def test_create_requires_brand_name():
    app = FastAPI()
    app.include_router(brand_requests.router)
    assert TestClient(app).post("/api/brand-requests", json={}).status_code == 400
