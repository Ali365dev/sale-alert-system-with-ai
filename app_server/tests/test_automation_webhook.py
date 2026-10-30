"""Tests for the Gmail webhook + dispatch helper (app/api/routers/automation.py).

Covers spec scenarios: webhook returns quickly (1), a notification creates
an automation job (2), a duplicate notification does not create a duplicate
job (3), and automation-disabled means no job gets created (12).

The webhook route is mounted on a standalone FastAPI app containing only
this router — not the real app.main:app — so tests never trigger the real
lifespan (which calls database.db.init_db() against the live DB)."""
import time

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.api.routers import automation
from app.core.security import AdminAuthError


def make_test_app() -> FastAPI:
    """Same router + the same AdminAuthError -> 401 JSON mapping app.main.py
    registers — without this, an unauthenticated request to an admin route
    would surface here as an unhandled exception instead of a clean 401."""
    app = FastAPI()

    @app.exception_handler(AdminAuthError)
    def _admin_auth_error_handler(request: Request, exc: AdminAuthError):
        return JSONResponse({"error": "not authenticated"}, status_code=401)

    app.include_router(automation.router)
    app.include_router(automation.admin_router)
    return app


def test_webhook_ignores_wrong_token(mocker):
    mocker.patch("app.api.routers.automation.get_setting", return_value="correct-secret")
    dispatch = mocker.patch("app.api.routers.automation._start_automation_job_if_needed")

    client = TestClient(make_test_app())
    resp = client.post("/api/gmail/webhook", params={"token": "wrong"})

    assert resp.status_code == 200
    assert resp.json()["status"] == "ignored"
    dispatch.assert_not_called()


def test_webhook_missing_token_is_ignored_not_422(mocker):
    mocker.patch("app.api.routers.automation.get_setting", return_value="correct-secret")
    dispatch = mocker.patch("app.api.routers.automation._start_automation_job_if_needed")

    client = TestClient(make_test_app())
    resp = client.post("/api/gmail/webhook")

    assert resp.status_code == 200  # never a validation-error retry target for Pub/Sub
    dispatch.assert_not_called()


def test_webhook_returns_fast_and_dispatches_on_correct_token(mocker):
    """Scenario 1 + 2: correct token -> 200 immediately, dispatch called
    exactly once. "Fast" here means the handler itself does no blocking
    work — _start_automation_job_if_needed is mocked, so this also proves
    the route doesn't do anything else slow before/after calling it."""
    def get_setting_side_effect(key, default=None):
        return "correct-secret" if key == "gmail_webhook_secret" else default

    mocker.patch("app.api.routers.automation.get_setting", side_effect=get_setting_side_effect)
    dispatch = mocker.patch("app.api.routers.automation._start_automation_job_if_needed", return_value={"id": 1})

    client = TestClient(make_test_app())
    start = time.monotonic()
    resp = client.post("/api/gmail/webhook", params={"token": "correct-secret"})
    elapsed = time.monotonic() - start

    assert resp.status_code == 200
    assert resp.json()["status"] == "received"
    assert elapsed < 1.0
    dispatch.assert_called_once()


def test_dispatch_noop_when_automation_disabled(mocker):
    """Scenario 12: automatic_email_processing off -> no job created, even
    though the webhook itself is still "received" successfully."""
    mocker.patch("app.api.routers.automation.get_setting", return_value=False)
    create_job = mocker.patch("app.api.routers.automation.job_service.create_job")

    result = automation._start_automation_job_if_needed()

    assert result is None
    create_job.assert_not_called()


def test_dispatch_noop_when_job_already_active(mocker):
    """Scenario 3: a second trigger while a run is already active must not
    start a duplicate job — collect_work's own history-based discovery on
    the next run is what picks up anything the active run doesn't."""
    def get_setting_side_effect(key, default=None):
        return True if key == "automatic_email_processing" else default

    mocker.patch("app.api.routers.automation.get_setting", side_effect=get_setting_side_effect)
    mocker.patch("app.api.routers.automation.job_service.get_active_job", return_value={"id": 42, "status": "running"})
    create_job = mocker.patch("app.api.routers.automation.job_service.create_job")

    result = automation._start_automation_job_if_needed()

    assert result is None
    create_job.assert_not_called()


def test_dispatch_starts_job_when_enabled_and_idle(mocker):
    def get_setting_side_effect(key, default=None):
        return True if key == "automatic_email_processing" else default

    mocker.patch("app.api.routers.automation.get_setting", side_effect=get_setting_side_effect)
    mocker.patch("app.api.routers.automation.job_service.get_active_job", return_value=None)
    mocker.patch("app.api.routers.automation.job_service.create_job", return_value={"id": 99, "status": "pending"})
    mock_runner = mocker.Mock()
    mocker.patch("app.api.routers.automation.job_runner.get_runner", return_value=mock_runner)
    mock_thread = mocker.patch("app.api.routers.automation.threading.Thread")

    result = automation._start_automation_job_if_needed()

    assert result == {"id": 99, "status": "pending"}
    mock_thread.assert_called_once()
    assert mock_thread.call_args.kwargs["daemon"] is True


def test_admin_jobs_endpoints_require_auth():
    client = TestClient(make_test_app())

    assert client.get("/api/automation/config").status_code == 401
    assert client.get("/api/automation/jobs").status_code == 401
    assert client.get("/api/automation/jobs/1").status_code == 401
