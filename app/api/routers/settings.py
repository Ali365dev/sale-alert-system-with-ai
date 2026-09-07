"""Settings module endpoints — API keys, prompts, Gmail config, system
prefs, Google account status, audit log, import/export. Ported from
api/settings.py — logic and response shapes unchanged.

Split into two routers sharing the same /api/settings prefix: `router`
(login/logout/session — public) and `admin_router` (everything else),
which carries Depends(require_admin) once at the router level instead of
repeating it on every one of the ~20 routes below, matching what
services.settings_auth.require_admin's decorator did in one place in the
original Flask blueprint."""
import json
import time
from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, Query, Request, Response
from fastapi.responses import JSONResponse

from ai.providers import is_rate_limit_message
from app.core.security import require_admin
from services import settings_auth, settings_service

router = APIRouter(prefix="/api/settings", tags=["settings"])
admin_router = APIRouter(prefix="/api/settings", tags=["settings"], dependencies=[Depends(require_admin)])


def _actor() -> str:
    return "admin"


def _cookie_kwargs(request: Request) -> dict:
    """See api/settings.py's original docstring for the full rationale —
    unchanged: SameSite=None;Secure when not local dev, else Lax/non-secure."""
    host = request.headers.get("host", "").split(":")[0]
    is_local = host in ("localhost", "127.0.0.1")
    return {"samesite": "lax", "secure": False} if is_local else {"samesite": "none", "secure": True}


# ── Auth (public) ────────────────────────────────────────────────────────────

@router.post("/login")
def login(request: Request, response: Response, body: dict = Body(default={})):
    body = body or {}
    password = body.get("password") or ""
    if not password:
        return JSONResponse({"error": "password required"}, status_code=400)

    if not settings_auth.has_admin_password():
        settings_auth.set_admin_password(password)
    elif not settings_auth.check_admin_password(password):
        return JSONResponse({"error": "invalid password"}, status_code=401)

    response.set_cookie(
        settings_auth.SESSION_COOKIE, settings_auth.create_session_token(),
        max_age=settings_auth.SESSION_MAX_AGE, httponly=True, **_cookie_kwargs(request),
    )
    return {"status": "ok"}


@router.post("/logout")
def logout(request: Request, response: Response):
    response.delete_cookie(settings_auth.SESSION_COOKIE, **_cookie_kwargs(request))
    return {"status": "ok"}


@router.get("/session")
def session_status(request: Request):
    authed = settings_auth.verify_session_token(request.cookies.get(settings_auth.SESSION_COOKIE))
    return {"authenticated": authed, "setup_required": not settings_auth.has_admin_password()}


# ── Google account (admin) ───────────────────────────────────────────────────

@admin_router.get("/google-account")
def google_account():
    from gmail.gmail_client import is_connected

    connected = is_connected()
    info = {"connected": connected, "email": None, "messages_total": None, "threads_total": None, "last_sync": None}
    if connected:
        try:
            from gmail.gmail_service import _get_session, get_mailbox_profile
            profile = get_mailbox_profile(_get_session())
            info["email"] = profile.get("emailAddress")
            info["messages_total"] = profile.get("messagesTotal")
            info["threads_total"] = profile.get("threadsTotal")
        except Exception as exc:
            info["error"] = str(exc)

    from services import job_service
    last_sync_jobs, _ = job_service.list_jobs(job_type="email_sync", status="completed", limit=1)
    if last_sync_jobs:
        info["last_sync"] = last_sync_jobs[0]["finished_at"]

    return info


@admin_router.post("/google-account/disconnect")
def google_disconnect():
    from gmail.gmail_client import disconnect

    disconnect()
    settings_service.write_audit(_actor(), "google_account.disconnect", "gmail", None, "connected", "disconnected")
    return {"status": "disconnected"}


@admin_router.post("/google-account/connect")
def google_connect():
    """Triggers the OAuth consent flow directly (not via a full email_sync
    job) — blocks waiting for browser consent, so it's dispatched on a
    background thread; the caller polls GET /google-account."""
    import threading

    def _run():
        try:
            from gmail.gmail_client import get_credentials
            get_credentials()
        except Exception as exc:
            from config import logger
            logger.error("Google connect flow failed: %s", exc)

    threading.Thread(target=_run, daemon=True).start()
    settings_service.write_audit(_actor(), "google_account.connect_requested", "gmail", None, None, None)
    return JSONResponse({"status": "started"}, status_code=202)


@admin_router.get("/gmail-labels")
def gmail_labels():
    """All Gmail labels on the connected account, for the label picker."""
    try:
        from gmail.gmail_labels import list_all_labels
        from gmail.gmail_service import _get_session
        return {"labels": list_all_labels(_get_session())}
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=502)


# ── API keys (admin) ─────────────────────────────────────────────────────────

@admin_router.get("/api-keys")
def list_api_keys(provider: str | None = Query(None)):
    return {"keys": settings_service.list_api_keys(provider)}


@admin_router.post("/api-keys")
def create_api_key(body: dict = Body(default={})):
    body = body or {}
    provider, name, raw_key = body.get("provider"), body.get("name"), body.get("key")
    if not provider or not name or not raw_key:
        return JSONResponse({"error": "provider, name, and key are required"}, status_code=400)
    if provider not in ("gemini", "groq", "tavily"):
        return JSONResponse({"error": f"unknown provider {provider!r}"}, status_code=400)

    existing = settings_service.list_api_keys(provider)
    priority = body.get("priority", (max((k["priority"] for k in existing), default=-1) + 1))
    result = settings_service.create_api_key(provider, name, raw_key, priority=priority, actor=_actor())
    return JSONResponse(result, status_code=201)


@admin_router.put("/api-keys/{key_id}")
def update_api_key(key_id: int, body: dict = Body(default={})):
    body = body or {}
    fields = {k: v for k, v in body.items() if k in ("name", "priority", "is_enabled", "status")}
    if body.get("key"):
        fields["raw_key"] = body["key"]
    result = settings_service.update_api_key(key_id, actor=_actor(), **fields)
    if result is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return result


@admin_router.delete("/api-keys/{key_id}")
def delete_api_key(key_id: int):
    ok = settings_service.delete_api_key(key_id, actor=_actor())
    if not ok:
        return JSONResponse({"error": "not found"}, status_code=404)
    return {"status": "deleted"}


@admin_router.put("/api-keys/reorder")
def reorder_api_keys(body: dict = Body(default={})):
    body = body or {}
    order = body.get("order")
    if not isinstance(order, list) or not order or not all(isinstance(i, int) for i in order):
        return JSONResponse({"error": "order (list of key ids) is required"}, status_code=400)
    result = settings_service.reorder_api_keys(order, actor=_actor())
    return {"keys": result}


def _test_provider_key(provider: str, raw_key: str, model: str | None) -> tuple[bool, str | None, float]:
    start = time.monotonic()
    try:
        if provider == "gemini":
            from google import genai
            client = genai.Client(api_key=raw_key)
            client.models.generate_content(model=model or "gemini-2.5-flash", contents="ping")
        elif provider == "groq":
            from groq import Groq
            client = Groq(api_key=raw_key)
            client.chat.completions.create(
                model=model or "openai/gpt-oss-120b",
                messages=[{"role": "user", "content": "ping"}], max_tokens=5,
            )
        elif provider == "tavily":
            import requests
            resp = requests.post(
                "https://api.tavily.com/search",
                json={"api_key": raw_key, "query": "ping", "max_results": 1},
                timeout=15,
            )
            resp.raise_for_status()
        else:
            return False, f"unknown provider {provider!r}", 0.0
        return True, None, round(time.monotonic() - start, 2)
    except Exception as exc:
        return False, str(exc), round(time.monotonic() - start, 2)


@admin_router.post("/api-keys/{key_id}/test")
def test_api_key(key_id: int):
    keys = settings_service.list_api_keys()
    row = next((k for k in keys if k["id"] == key_id), None)
    if row is None:
        return JSONResponse({"error": "not found"}, status_code=404)

    from database.db import get_session
    from database.models import ApiKey
    with get_session() as session:
        db_row = session.query(ApiKey).filter(ApiKey.id == key_id).first()
        raw_key = settings_service.decrypt_key(db_row.encrypted_key)

    model = settings_service.get_setting(f"{row['provider']}_model")
    ok, error, latency = _test_provider_key(row["provider"], raw_key, model)
    settings_service.record_key_test(key_id, ok, error)
    return {
        "ok": ok,
        "error": error,
        "latency_seconds": latency,
        "rate_limited": is_rate_limit_message(error),
    }


# ── Providers (admin) ────────────────────────────────────────────────────────

@admin_router.get("/providers")
def get_providers():
    from ai._llm import get_active_provider, get_key_health, get_provider_health
    from ai.providers import PROVIDER_NAMES, normalize_provider_enabled, normalize_provider_order

    gemini_keys = settings_service.list_api_keys("gemini")
    groq_keys = settings_service.list_api_keys("groq")
    requests_today = {
        "gemini": sum(k["daily_usage_count"] for k in gemini_keys),
        "groq": sum(k["daily_usage_count"] for k in groq_keys),
        "ollama": 0,
    }

    return {
        "gemini_model": settings_service.get_setting("gemini_model"),
        "groq_model": settings_service.get_setting("groq_model"),
        "gemini_keys": gemini_keys,
        "groq_keys": groq_keys,
        "tavily_keys": settings_service.list_api_keys("tavily"),
        "provider_order": normalize_provider_order(settings_service.get_setting("provider_order")),
        "provider_enabled": normalize_provider_enabled(settings_service.get_setting("provider_enabled")),
        "provider_names": PROVIDER_NAMES,
        "active_provider": get_active_provider(),
        "provider_health": get_provider_health(),
        "provider_requests_today": requests_today,
        "gemini_key_health": get_key_health("gemini"),
        "groq_key_health": get_key_health("groq"),
    }


@admin_router.put("/providers")
def update_providers(body: dict = Body(default={})):
    from ai.providers import normalize_provider_enabled, normalize_provider_order

    body = body or {}
    for field in ("gemini_model", "groq_model"):
        if field in body:
            settings_service.set_setting(field, body[field], category="providers", actor=_actor())
    if "provider_order" in body:
        order = body["provider_order"]
        if not isinstance(order, list) or not order or not all(isinstance(x, str) for x in order):
            return JSONResponse({"error": "provider_order must be a non-empty list of provider names"}, status_code=400)
        settings_service.set_setting("provider_order", normalize_provider_order(order), category="providers", actor=_actor())
    if "provider_enabled" in body:
        enabled = body["provider_enabled"]
        if not isinstance(enabled, dict):
            return JSONResponse({"error": "provider_enabled must be an object of {provider: bool}"}, status_code=400)
        merged = normalize_provider_enabled(settings_service.get_setting("provider_enabled"))
        merged.update({k: bool(v) for k, v in enabled.items() if k in merged})
        settings_service.set_setting("provider_enabled", merged, category="providers", actor=_actor())
    return {"status": "ok"}


# ── Email processing (admin) ─────────────────────────────────────────────────

_EMAIL_PROCESSING_KEYS = [
    "gmail_label", "gmail_brand_label", "max_emails_per_sync", "retry_attempts",
    "request_timeout_seconds", "auto_analyze_emails", "auto_apply_gmail_label",
    "skip_already_labeled", "skip_duplicate_emails", "ocr_max_images_per_email",
    "latest_emails_limit",
    # Automatic new-email pipeline (app/api/routers/automation.py) — admin
    # toggle + the GCP Pub/Sub topic name. gmail_webhook_secret is
    # deliberately NOT here (it's exposed read-only via
    # GET /api/automation/config, not editable through this generic form).
    "automatic_email_processing", "gmail_pubsub_topic",
]


@admin_router.get("/email-processing")
def get_email_processing():
    from config import OCR_MAX_IMAGES_PER_EMAIL

    values = {k: settings_service.get_setting(k) for k in _EMAIL_PROCESSING_KEYS}
    values["ocr_max_images_per_email"] = settings_service.get_setting(
        "ocr_max_images_per_email", default=OCR_MAX_IMAGES_PER_EMAIL
    )
    values["fetch_interval_minutes"] = settings_service.get_setting("fetch_interval_minutes", default=60)
    values["_fetch_interval_wired"] = False
    return values


@admin_router.put("/email-processing")
def update_email_processing(body: dict = Body(default={})):
    body = body or {}
    for key in _EMAIL_PROCESSING_KEYS + ["fetch_interval_minutes"]:
        if key in body:
            settings_service.set_setting(key, body[key], category="email_processing", actor=_actor())
    return {"status": "ok"}


# ── Sale filter (admin) ──────────────────────────────────────────────────────
# Admin-editable weak-keyword list for ai/sale_filter.py's pre-AI relevance
# scoring — the regex-based patterns (% off, BOGO, was/now price pairs,
# etc.) stay code-only, not exposed here, since a malformed regex from the
# admin UI could break the filter for every incoming email; both keyword
# lists below are plain strings/phrases (substring matches, no regex), safe
# to edit freely and cheap to test against pasted content below.

@admin_router.get("/sale-filter")
def get_sale_filter():
    from ai.sale_filter import DEFAULT_STRONG_KEYWORDS, DEFAULT_WEAK_KEYWORDS

    weak = settings_service.get_setting("sale_filter_weak_keywords", default=DEFAULT_WEAK_KEYWORDS)
    strong = settings_service.get_setting("sale_filter_strong_keywords", default=DEFAULT_STRONG_KEYWORDS)
    return {
        "weak_keywords": weak if isinstance(weak, list) else DEFAULT_WEAK_KEYWORDS,
        "default_weak_keywords": DEFAULT_WEAK_KEYWORDS,
        "strong_keywords": strong if isinstance(strong, list) else DEFAULT_STRONG_KEYWORDS,
        "default_strong_keywords": DEFAULT_STRONG_KEYWORDS,
    }


def _clean_keyword_list(keywords) -> list[str] | None:
    if not isinstance(keywords, list) or not all(isinstance(k, str) for k in keywords):
        return None
    return sorted({k.strip().lower() for k in keywords if k.strip()})


@admin_router.put("/sale-filter")
def update_sale_filter(body: dict = Body(default={})):
    body = body or {}
    result = {}

    if "weak_keywords" in body:
        cleaned = _clean_keyword_list(body["weak_keywords"])
        if cleaned is None:
            return JSONResponse({"error": "weak_keywords must be a list of strings"}, status_code=400)
        settings_service.set_setting("sale_filter_weak_keywords", cleaned, category="sale_filter", actor=_actor())
        result["weak_keywords"] = cleaned

    if "strong_keywords" in body:
        cleaned = _clean_keyword_list(body["strong_keywords"])
        if cleaned is None:
            return JSONResponse({"error": "strong_keywords must be a list of strings"}, status_code=400)
        settings_service.set_setting("sale_filter_strong_keywords", cleaned, category="sale_filter", actor=_actor())
        result["strong_keywords"] = cleaned

    return result


@admin_router.post("/sale-filter/test")
def test_sale_filter(body: dict = Body(default={})):
    """Runs the real evaluate() (same code path every incoming email goes
    through) against admin-pasted sample content — no LLM call involved, so
    unlike POST /prompts/{key}/test this is instant and free."""
    from ai.sale_filter import evaluate

    body = body or {}
    result = evaluate(body.get("subject") or "", body.get("body") or "", body.get("ocr_text") or "")
    return {"score": result.score, "status": result.status, "reason": result.reason}


# ── Prompts (admin) ──────────────────────────────────────────────────────────

@admin_router.get("/prompts")
def list_prompts():
    return {"prompts": settings_service.list_prompts()}


@admin_router.put("/prompts/{key}")
def update_prompt(key: str, body: dict = Body(default={})):
    body = body or {}
    content = body.get("content")
    if content is None:
        return JSONResponse({"error": "content required"}, status_code=400)
    result = settings_service.update_prompt(key, content, actor=_actor())
    if result is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return result


@admin_router.post("/prompts/{key}/restore-default")
def restore_prompt(key: str):
    result = settings_service.restore_prompt_default(key, actor=_actor())
    if result is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return result


@admin_router.post("/prompts/{key}/duplicate")
def duplicate_prompt(key: str):
    result = settings_service.duplicate_prompt(key, actor=_actor())
    if result is None:
        return JSONResponse({"error": "not found"}, status_code=404)
    return JSONResponse(result, status_code=201)


@admin_router.post("/prompts/{key}/test")
def test_prompt(key: str, body: dict = Body(default={})):
    """Paste a sample email, run it through the real provider call path,
    return both the raw response and (best-effort) parsed JSON."""
    body = body or {}
    sample_subject = body.get("subject", "")
    sample_body = body.get("body", "")
    sample_brand_name = body.get("brand_name") or "TestBrand"
    sample_website = body.get("website") or "https://example.com"
    sample_categories = body.get("categories") or "General"

    prompts = {p["key"]: p["content"] for p in settings_service.list_prompts()}
    template = prompts.get(key)
    if template is None:
        return JSONResponse({"error": "not found"}, status_code=404)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        prompt = template.format(
            today=today, subject=sample_subject, body=sample_body, sender="test@example.com",
            brand_name=sample_brand_name, website=sample_website, categories=sample_categories,
            search_block="(test — no real search results)", results_text="(test — no real search results)",
            brand_name_upper=sample_brand_name.upper(), today_year=today[:4],
            brand=sample_brand_name, company=sample_brand_name, category="General", subcategory="General",
            offer_type="Discount", discount_percentage="20", coupon_code="TEST20",
            expiry_date="2026-12-31", offer_value="20% off", summary="Test offer", key_highlights="None",
            offers_text=sample_body or "(no offers provided)",
        )
    except KeyError as exc:
        return JSONResponse({"error": f"template references unknown placeholder {exc}"}, status_code=400)

    from ai._llm import call_llm
    raw = call_llm(prompt)
    parsed = None
    if raw:
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            import re
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if match:
                try:
                    parsed = json.loads(match.group())
                except json.JSONDecodeError:
                    pass
    return {"raw_response": raw, "parsed": parsed}


# ── System (admin) ───────────────────────────────────────────────────────────

_SYSTEM_KEYS = ["timezone", "date_format", "theme", "log_level"]


@admin_router.get("/system")
def get_system():
    return {k: settings_service.get_setting(k) for k in _SYSTEM_KEYS}


@admin_router.put("/system")
def update_system(body: dict = Body(default={})):
    body = body or {}
    for key in _SYSTEM_KEYS:
        if key in body:
            settings_service.set_setting(key, body[key], category="system", actor=_actor())
    if "log_level" in body:
        import logging
        logging.getLogger("gmail_dashboard").setLevel(getattr(logging, str(body["log_level"]).upper(), logging.INFO))
    return {"status": "ok"}


# ── Audit log (admin) ────────────────────────────────────────────────────────

@admin_router.get("/audit-log")
def audit_log(limit: int = Query(50), offset: int = Query(0)):
    entries, total = settings_service.list_audit_log(limit=limit, offset=offset)
    return {"entries": entries, "total": total}


# ── Import / export (admin, JSON only, no secrets round-tripped) ────────────

@admin_router.get("/export")
def export_settings():
    return {
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "prompts": [
            {"key": p["key"], "content": p["content"]} for p in settings_service.list_prompts()
        ],
        "settings": settings_service.get_all_settings(),
        "note": "API keys are never included in export — re-add them manually after import.",
    }


@admin_router.post("/import")
def import_settings(body: dict = Body(default={})):
    body = body or {}
    imported = {"prompts": 0, "settings": 0}

    for p in body.get("prompts", []):
        if settings_service.update_prompt(p["key"], p["content"], actor=_actor()) is not None:
            imported["prompts"] += 1

    for key, value in (body.get("settings") or {}).items():
        if key == "admin_password_hash":
            continue
        settings_service.set_setting(key, value, actor=_actor())
        imported["settings"] += 1

    settings_service.write_audit(_actor(), "settings.import", "settings", None, None, json.dumps(imported))
    return {"status": "ok", "imported": imported}
