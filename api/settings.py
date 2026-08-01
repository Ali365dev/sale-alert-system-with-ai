"""Settings module endpoints — API keys, prompts, Gmail config, system
prefs, Google account status, audit log, import/export. Everything except
/login is behind services.settings_auth.require_admin."""
import json
import time
from datetime import datetime, timezone

from flask import Blueprint, jsonify, make_response, request

from ai.providers import is_rate_limit_message
from services import settings_auth, settings_service

bp = Blueprint("settings", __name__, url_prefix="/api/settings")


def _actor() -> str:
    return "admin"


# ── Auth ─────────────────────────────────────────────────────────────────────

@bp.post("/login")
def login():
    body = request.get_json(silent=True) or {}
    password = body.get("password") or ""
    if not password:
        return jsonify({"error": "password required"}), 400

    if not settings_auth.has_admin_password():
        settings_auth.set_admin_password(password)
    elif not settings_auth.check_admin_password(password):
        return jsonify({"error": "invalid password"}), 401

    resp = make_response(jsonify({"status": "ok"}))
    resp.set_cookie(
        settings_auth.SESSION_COOKIE, settings_auth.create_session_token(),
        max_age=settings_auth.SESSION_MAX_AGE, httponly=True, samesite="Lax",
    )
    return resp


@bp.post("/logout")
def logout():
    resp = make_response(jsonify({"status": "ok"}))
    resp.delete_cookie(settings_auth.SESSION_COOKIE)
    return resp


@bp.get("/session")
def session_status():
    authed = settings_auth.verify_session_token(request.cookies.get(settings_auth.SESSION_COOKIE))
    return jsonify({"authenticated": authed, "setup_required": not settings_auth.has_admin_password()})


# ── Google account ───────────────────────────────────────────────────────────

@bp.get("/google-account")
@settings_auth.require_admin
def google_account():
    from config import GMAIL_TOKEN_FILE
    import os

    connected = os.path.exists(GMAIL_TOKEN_FILE)
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

    return jsonify(info)


@bp.post("/google-account/disconnect")
@settings_auth.require_admin
def google_disconnect():
    import os
    from config import GMAIL_TOKEN_FILE

    if os.path.exists(GMAIL_TOKEN_FILE):
        os.remove(GMAIL_TOKEN_FILE)
    settings_service.write_audit(_actor(), "google_account.disconnect", "gmail", None, "connected", "disconnected")
    return jsonify({"status": "disconnected"})


@bp.post("/google-account/connect")
@settings_auth.require_admin
def google_connect():
    """Triggers the OAuth consent flow directly (not via a full email_sync
    job) — same underlying limitation as before: this blocks waiting for
    browser consent, so it's dispatched on a background thread and the
    caller should poll GET /google-account to see when it completes."""
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
    return jsonify({"status": "started"}), 202


@bp.get("/gmail-labels")
@settings_auth.require_admin
def gmail_labels():
    """All Gmail labels on the connected account, for the label picker."""
    try:
        from gmail.gmail_labels import list_all_labels
        from gmail.gmail_service import _get_session
        return jsonify({"labels": list_all_labels(_get_session())})
    except Exception as exc:
        return jsonify({"error": str(exc)}), 502


# ── API keys ─────────────────────────────────────────────────────────────────

@bp.get("/api-keys")
@settings_auth.require_admin
def list_api_keys():
    provider = request.args.get("provider")
    return jsonify({"keys": settings_service.list_api_keys(provider)})


@bp.post("/api-keys")
@settings_auth.require_admin
def create_api_key():
    body = request.get_json(silent=True) or {}
    provider, name, raw_key = body.get("provider"), body.get("name"), body.get("key")
    if not provider or not name or not raw_key:
        return jsonify({"error": "provider, name, and key are required"}), 400
    if provider not in ("gemini", "groq", "tavily"):
        return jsonify({"error": f"unknown provider {provider!r}"}), 400

    existing = settings_service.list_api_keys(provider)
    priority = body.get("priority", (max((k["priority"] for k in existing), default=-1) + 1))
    result = settings_service.create_api_key(provider, name, raw_key, priority=priority, actor=_actor())
    return jsonify(result), 201


@bp.put("/api-keys/<int:key_id>")
@settings_auth.require_admin
def update_api_key(key_id: int):
    body = request.get_json(silent=True) or {}
    fields = {k: v for k, v in body.items() if k in ("name", "priority", "is_enabled", "status")}
    if body.get("key"):
        fields["raw_key"] = body["key"]
    result = settings_service.update_api_key(key_id, actor=_actor(), **fields)
    if result is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(result)


@bp.delete("/api-keys/<int:key_id>")
@settings_auth.require_admin
def delete_api_key(key_id: int):
    ok = settings_service.delete_api_key(key_id, actor=_actor())
    if not ok:
        return jsonify({"error": "not found"}), 404
    return jsonify({"status": "deleted"})


@bp.put("/api-keys/reorder")
@settings_auth.require_admin
def reorder_api_keys():
    body = request.get_json(silent=True) or {}
    order = body.get("order")
    if not isinstance(order, list) or not order or not all(isinstance(i, int) for i in order):
        return jsonify({"error": "order (list of key ids) is required"}), 400
    result = settings_service.reorder_api_keys(order, actor=_actor())
    return jsonify({"keys": result})


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
                model=model or "llama-3.3-70b-versatile",
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


@bp.post("/api-keys/<int:key_id>/test")
@settings_auth.require_admin
def test_api_key(key_id: int):
    keys = settings_service.list_api_keys()
    row = next((k for k in keys if k["id"] == key_id), None)
    if row is None:
        return jsonify({"error": "not found"}), 404

    from database.db import get_session
    from database.models import ApiKey
    with get_session() as session:
        db_row = session.query(ApiKey).filter(ApiKey.id == key_id).first()
        raw_key = settings_service.decrypt_key(db_row.encrypted_key)

    model = settings_service.get_setting(f"{row['provider']}_model")
    ok, error, latency = _test_provider_key(row["provider"], raw_key, model)
    settings_service.record_key_test(key_id, ok, error)
    return jsonify({
        "ok": ok,
        "error": error,
        "latency_seconds": latency,
        "rate_limited": is_rate_limit_message(error),
    })


# ── Providers (model names, priority order) ─────────────────────────────────

@bp.get("/providers")
@settings_auth.require_admin
def get_providers():
    from ai._llm import get_active_provider, get_provider_health
    from ai.providers import PROVIDER_NAMES, normalize_provider_enabled, normalize_provider_order

    gemini_keys = settings_service.list_api_keys("gemini")
    groq_keys = settings_service.list_api_keys("groq")
    requests_today = {
        "gemini": sum(k["daily_usage_count"] for k in gemini_keys),
        "groq": sum(k["daily_usage_count"] for k in groq_keys),
        "ollama": 0,  # local, no stored key — usage isn't tracked per-key
    }

    return jsonify({
        "gemini_model": settings_service.get_setting("gemini_model"),
        "groq_model": settings_service.get_setting("groq_model"),
        "gemini_keys": gemini_keys,
        "groq_keys": groq_keys,
        "tavily_keys": settings_service.list_api_keys("tavily"),
        # Provider-level priority — Gemini/Groq/Ollama only. Tavily is a
        # separate search API, not part of this LLM failover chain, so it's
        # excluded here (it still has its own key list above).
        "provider_order": normalize_provider_order(settings_service.get_setting("provider_order")),
        "provider_enabled": normalize_provider_enabled(settings_service.get_setting("provider_enabled")),
        "provider_names": PROVIDER_NAMES,
        "active_provider": get_active_provider(),
        "provider_health": get_provider_health(),
        "provider_requests_today": requests_today,
    })


@bp.put("/providers")
@settings_auth.require_admin
def update_providers():
    from ai.providers import normalize_provider_enabled, normalize_provider_order

    body = request.get_json(silent=True) or {}
    for field in ("gemini_model", "groq_model"):
        if field in body:
            settings_service.set_setting(field, body[field], category="providers", actor=_actor())
    if "provider_order" in body:
        order = body["provider_order"]
        if not isinstance(order, list) or not order or not all(isinstance(x, str) for x in order):
            return jsonify({"error": "provider_order must be a non-empty list of provider names"}), 400
        settings_service.set_setting("provider_order", normalize_provider_order(order), category="providers", actor=_actor())
    if "provider_enabled" in body:
        enabled = body["provider_enabled"]
        if not isinstance(enabled, dict):
            return jsonify({"error": "provider_enabled must be an object of {provider: bool}"}), 400
        # Merge onto the current value — a partial update (e.g. just
        # {"ollama": false}) must not silently re-enable providers the
        # normalize default would otherwise fill in as True.
        merged = normalize_provider_enabled(settings_service.get_setting("provider_enabled"))
        merged.update({k: bool(v) for k, v in enabled.items() if k in merged})
        settings_service.set_setting("provider_enabled", merged, category="providers", actor=_actor())
    return jsonify({"status": "ok"})


# ── Email processing ─────────────────────────────────────────────────────────

_EMAIL_PROCESSING_KEYS = [
    "gmail_label", "gmail_brand_label", "max_emails_per_sync", "retry_attempts",
    "request_timeout_seconds", "auto_analyze_emails", "auto_apply_gmail_label",
    "skip_already_labeled", "skip_duplicate_emails",
]


@bp.get("/email-processing")
@settings_auth.require_admin
def get_email_processing():
    values = {k: settings_service.get_setting(k) for k in _EMAIL_PROCESSING_KEYS}
    # "fetch interval" has no effect without a real scheduler (none exists in this
    # app today) — surfaced as unwired rather than silently doing nothing.
    values["fetch_interval_minutes"] = settings_service.get_setting("fetch_interval_minutes", default=60)
    values["_fetch_interval_wired"] = False
    return jsonify(values)


@bp.put("/email-processing")
@settings_auth.require_admin
def update_email_processing():
    body = request.get_json(silent=True) or {}
    for key in _EMAIL_PROCESSING_KEYS + ["fetch_interval_minutes"]:
        if key in body:
            settings_service.set_setting(key, body[key], category="email_processing", actor=_actor())
    return jsonify({"status": "ok"})


# ── Prompts ──────────────────────────────────────────────────────────────────

@bp.get("/prompts")
@settings_auth.require_admin
def list_prompts():
    return jsonify({"prompts": settings_service.list_prompts()})


@bp.put("/prompts/<key>")
@settings_auth.require_admin
def update_prompt(key: str):
    body = request.get_json(silent=True) or {}
    content = body.get("content")
    if content is None:
        return jsonify({"error": "content required"}), 400
    result = settings_service.update_prompt(key, content, actor=_actor())
    if result is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(result)


@bp.post("/prompts/<key>/restore-default")
@settings_auth.require_admin
def restore_prompt(key: str):
    result = settings_service.restore_prompt_default(key, actor=_actor())
    if result is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(result)


@bp.post("/prompts/<key>/duplicate")
@settings_auth.require_admin
def duplicate_prompt(key: str):
    result = settings_service.duplicate_prompt(key, actor=_actor())
    if result is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(result), 201


@bp.post("/prompts/<key>/test")
@settings_auth.require_admin
def test_prompt(key: str):
    """Paste a sample email, run it through the real provider call path,
    return both the raw response and (best-effort) parsed JSON."""
    body = request.get_json(silent=True) or {}
    sample_subject = body.get("subject", "")
    sample_body = body.get("body", "")
    sample_brand_name = body.get("brand_name") or "TestBrand"
    sample_website = body.get("website") or "https://example.com"
    sample_categories = body.get("categories") or "General"

    prompts = {p["key"]: p["content"] for p in settings_service.list_prompts()}
    template = prompts.get(key)
    if template is None:
        return jsonify({"error": "not found"}), 404

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
        return jsonify({"error": f"template references unknown placeholder {exc}"}), 400

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
    return jsonify({"raw_response": raw, "parsed": parsed})


# ── System ───────────────────────────────────────────────────────────────────

_SYSTEM_KEYS = ["timezone", "date_format", "theme", "log_level"]


@bp.get("/system")
@settings_auth.require_admin
def get_system():
    return jsonify({k: settings_service.get_setting(k) for k in _SYSTEM_KEYS})


@bp.put("/system")
@settings_auth.require_admin
def update_system():
    body = request.get_json(silent=True) or {}
    for key in _SYSTEM_KEYS:
        if key in body:
            settings_service.set_setting(key, body[key], category="system", actor=_actor())
    if "log_level" in body:
        import logging
        logging.getLogger("gmail_dashboard").setLevel(getattr(logging, str(body["log_level"]).upper(), logging.INFO))
    return jsonify({"status": "ok"})


# ── Audit log ────────────────────────────────────────────────────────────────

@bp.get("/audit-log")
@settings_auth.require_admin
def audit_log():
    limit = request.args.get("limit", 50, type=int)
    offset = request.args.get("offset", 0, type=int)
    entries, total = settings_service.list_audit_log(limit=limit, offset=offset)
    return jsonify({"entries": entries, "total": total})


# ── Import / export (JSON only, no secrets round-tripped) ──────────────────────

@bp.get("/export")
@settings_auth.require_admin
def export_settings():
    return jsonify({
        "exported_at": datetime.now(timezone.utc).isoformat(),
        "prompts": [
            {"key": p["key"], "content": p["content"]} for p in settings_service.list_prompts()
        ],
        "settings": settings_service.get_all_settings(),
        "note": "API keys are never included in export — re-add them manually after import.",
    })


@bp.post("/import")
@settings_auth.require_admin
def import_settings():
    body = request.get_json(silent=True) or {}
    imported = {"prompts": 0, "settings": 0}

    for p in body.get("prompts", []):
        if settings_service.update_prompt(p["key"], p["content"], actor=_actor()) is not None:
            imported["prompts"] += 1

    for key, value in (body.get("settings") or {}).items():
        if key == "admin_password_hash":
            continue  # never import auth material
        settings_service.set_setting(key, value, actor=_actor())
        imported["settings"] += 1

    settings_service.write_audit(_actor(), "settings.import", "settings", None, None, json.dumps(imported))
    return jsonify({"status": "ok", "imported": imported})
