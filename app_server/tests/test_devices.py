from datetime import datetime

from fastapi import FastAPI
from fastapi.testclient import TestClient

from routers import devices


def _client():
    app = FastAPI()
    app.include_router(devices.router)
    return TestClient(app)


def test_register_is_served_at_the_path_the_app_calls(mocker, mock_get_session, mock_session):
    """Regression: after the server split this path 404'd on app_server, so no
    phone could register or refresh its push token."""
    mocker.patch.object(devices, "get_session", mock_get_session)
    existing = mocker.Mock(last_seen_at=datetime(2026, 10, 1))
    mock_session.query.return_value.filter.return_value.first.return_value = existing

    r = _client().post(
        "/api/notifications/devices/register",
        json={"token": "tok", "platform": "ios", "device_id": "dev-1"},
    )

    assert r.status_code == 200
    assert existing.is_active is True
    assert existing.last_seen_at > datetime(2026, 10, 1)


def test_register_rejects_missing_platform(mocker):
    r = _client().post("/api/notifications/devices/register", json={"token": "tok"})
    assert r.status_code == 400
