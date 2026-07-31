"""CRUD + encryption helpers backing the Settings module (api/settings.py).

Every read here is a fresh, uncached DB query — deliberately. AI calls in
this app already take multiple seconds (network + LLM inference); one extra
~50-100ms DB round trip per prompt/key/setting lookup is negligible, and
skipping a cache layer is what makes "changes take effect without a
restart" trivially true rather than something to invalidate correctly.
"""
import json
from datetime import datetime, timezone

from ai.providers import is_rate_limit_message
from database.db import get_session
from database.models import ApiKey, Prompt, Setting, SettingsAuditLog


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _dumps(value) -> str:
    return value if isinstance(value, str) else json.dumps(value)


def _loads(value: str | None, default=None):
    if value is None:
        return default
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return value  # plain string setting


# ── Encryption ───────────────────────────────────────────────────────────────

def _fernet():
    from config import SETTINGS_ENCRYPTION_KEY
    if not SETTINGS_ENCRYPTION_KEY:
        raise RuntimeError(
            "SETTINGS_ENCRYPTION_KEY is not set — required to store/read API keys. "
            "Generate one with: python -c \"from cryptography.fernet import Fernet; "
            "print(Fernet.generate_key().decode())\" and add it to .env."
        )
    from cryptography.fernet import Fernet
    return Fernet(SETTINGS_ENCRYPTION_KEY.encode())


def encrypt_key(raw_key: str) -> str:
    return _fernet().encrypt(raw_key.encode()).decode()


def decrypt_key(encrypted: str) -> str:
    return _fernet().decrypt(encrypted.encode()).decode()


def mask_key(raw_key: str) -> str:
    if len(raw_key) <= 8:
        return "*" * len(raw_key)
    return f"{raw_key[:4]}{'*' * 12}{raw_key[-4:]}"


# ── Generic settings KV ────────────────────────────────────────────────────────

def get_setting(key: str, default=None):
    with get_session() as session:
        row = session.query(Setting).filter(Setting.key == key).first()
        return _loads(row.value, default) if row else default


def set_setting(key: str, value, category: str | None = None, actor: str | None = None) -> None:
    with get_session() as session:
        row = session.query(Setting).filter(Setting.key == key).first()
        old_value = row.value if row else None
        new_value = _dumps(value)
        if row:
            row.value = new_value
            row.updated_by = actor
            if category:
                row.category = category
        else:
            session.add(Setting(key=key, value=new_value, category=category, updated_by=actor))
    if old_value != new_value:
        write_audit(actor, "setting.update", "setting", key, old_value, new_value)


def get_all_settings(category: str | None = None) -> dict:
    with get_session() as session:
        q = session.query(Setting)
        if category:
            q = q.filter(Setting.category == category)
        return {row.key: _loads(row.value) for row in q.all()}


# ── API keys ─────────────────────────────────────────────────────────────────

def _api_key_to_dict(row: ApiKey) -> dict:
    return {
        "id": row.id,
        "provider": row.provider,
        "name": row.name,
        "key_preview": row.key_preview,
        "priority": row.priority,
        "is_enabled": row.is_enabled,
        "status": row.status,
        "daily_usage_count": row.daily_usage_count,
        "last_used_at": row.last_used_at.isoformat() if row.last_used_at else None,
        "last_tested_at": row.last_tested_at.isoformat() if row.last_tested_at else None,
        "last_test_ok": row.last_test_ok,
        "last_error": row.last_error,
        "quota_exceeded": is_rate_limit_message(row.last_error),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def list_api_keys(provider: str | None = None) -> list[dict]:
    with get_session() as session:
        q = session.query(ApiKey)
        if provider:
            q = q.filter(ApiKey.provider == provider)
        rows = q.order_by(ApiKey.provider, ApiKey.priority).all()
        return [_api_key_to_dict(r) for r in rows]


def get_active_api_key(provider: str) -> str | None:
    """For single-key providers (Groq, Tavily) — the highest-priority active
    key's decrypted value, or None if none is configured. Unlike Gemini's
    multi-key rotation, callers here just use this one key as-is."""
    keys = get_active_api_keys(provider)
    return keys[0]["decrypted_key"] if keys else None


def get_active_api_keys(provider: str) -> list[dict]:
    """Enabled, non-invalid keys for a provider, priority-ordered — this is
    what GeminiProvider.call() (ai/providers.py) reads fresh on every call."""
    with get_session() as session:
        rows = (
            session.query(ApiKey)
            .filter(ApiKey.provider == provider, ApiKey.is_enabled.is_(True), ApiKey.status != "invalid")
            .order_by(ApiKey.priority)
            .all()
        )
        return [
            {"id": r.id, "name": r.name, "decrypted_key": decrypt_key(r.encrypted_key)}
            for r in rows
        ]


def create_api_key(provider: str, name: str, raw_key: str, priority: int = 0, actor: str | None = None) -> dict:
    encrypted = encrypt_key(raw_key)
    preview = mask_key(raw_key)
    with get_session() as session:
        row = ApiKey(provider=provider, name=name, encrypted_key=encrypted, key_preview=preview, priority=priority)
        session.add(row)
        session.flush()
        result = _api_key_to_dict(row)
    write_audit(actor, "api_key.create", "api_key", str(result["id"]), None, json.dumps({"provider": provider, "name": name}))
    return result


def update_api_key(key_id: int, actor: str | None = None, **fields) -> dict | None:
    raw_key = fields.pop("raw_key", None)
    with get_session() as session:
        row = session.query(ApiKey).filter(ApiKey.id == key_id).first()
        if not row:
            return None
        old = _api_key_to_dict(row)
        if raw_key:
            row.encrypted_key = encrypt_key(raw_key)
            row.key_preview = mask_key(raw_key)
            row.status = "active"
        for field in ("name", "priority", "is_enabled", "status"):
            if field in fields:
                setattr(row, field, fields[field])
        result = _api_key_to_dict(row)
    write_audit(actor, "api_key.update", "api_key", str(key_id), json.dumps(old), json.dumps(result))
    return result


def delete_api_key(key_id: int, actor: str | None = None) -> bool:
    with get_session() as session:
        row = session.query(ApiKey).filter(ApiKey.id == key_id).first()
        if not row:
            return False
        old = _api_key_to_dict(row)
        session.delete(row)
    write_audit(actor, "api_key.delete", "api_key", str(key_id), json.dumps(old), None)
    return True


def record_key_usage(key_id: int) -> None:
    """A successful call — clears any stale error (e.g. a since-recovered
    quota/rate-limit) so `quota_exceeded` reflects current, not historical, state."""
    with get_session() as session:
        row = session.query(ApiKey).filter(ApiKey.id == key_id).first()
        if row:
            row.last_used_at = _utcnow()
            row.daily_usage_count += 1
            row.last_error = None


def record_key_failure(key_id: int, reason: str, mark_invalid: bool = False) -> None:
    with get_session() as session:
        row = session.query(ApiKey).filter(ApiKey.id == key_id).first()
        if row:
            row.last_error = reason
            if mark_invalid:
                row.status = "invalid"


def record_key_test(key_id: int, ok: bool, error: str | None = None) -> None:
    with get_session() as session:
        row = session.query(ApiKey).filter(ApiKey.id == key_id).first()
        if row:
            row.last_tested_at = _utcnow()
            row.last_test_ok = ok
            row.last_error = error


# ── Prompts ──────────────────────────────────────────────────────────────────

def get_prompt(key: str, default: str) -> str:
    with get_session() as session:
        row = session.query(Prompt).filter(Prompt.key == key).first()
        return row.content if row else default


def _prompt_to_dict(row: Prompt) -> dict:
    return {
        "id": row.id,
        "key": row.key,
        "name": row.name,
        "description": row.description,
        "category": row.category,
        "content": row.content,
        "default_content": row.default_content,
        "version": row.version,
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }


def list_prompts() -> list[dict]:
    with get_session() as session:
        return [_prompt_to_dict(r) for r in session.query(Prompt).order_by(Prompt.category, Prompt.name).all()]


def seed_prompt_if_missing(key: str, name: str, description: str, category: str, default_content: str) -> None:
    with get_session() as session:
        if session.query(Prompt).filter(Prompt.key == key).first():
            return
        session.add(Prompt(
            key=key, name=name, description=description, category=category,
            content=default_content, default_content=default_content,
        ))


def update_prompt(key: str, content: str, actor: str | None = None) -> dict | None:
    with get_session() as session:
        row = session.query(Prompt).filter(Prompt.key == key).first()
        if not row:
            return None
        old_content = row.content
        row.content = content
        row.version += 1
        row.created_by = actor
        result = _prompt_to_dict(row)
    if old_content != content:
        write_audit(actor, "prompt.update", "prompt", key, old_content, content)
    return result


def restore_prompt_default(key: str, actor: str | None = None) -> dict | None:
    with get_session() as session:
        row = session.query(Prompt).filter(Prompt.key == key).first()
        if not row:
            return None
        old_content = row.content
        row.content = row.default_content
        row.version += 1
        result = _prompt_to_dict(row)
    write_audit(actor, "prompt.restore_default", "prompt", key, old_content, result["content"])
    return result


def duplicate_prompt(key: str, actor: str | None = None) -> dict | None:
    with get_session() as session:
        row = session.query(Prompt).filter(Prompt.key == key).first()
        if not row:
            return None
        new_key = f"{row.key}_copy_{int(_utcnow().timestamp())}"
        new_row = Prompt(
            key=new_key, name=f"{row.name} (Copy)", description=row.description, category=row.category,
            content=row.content, default_content=row.default_content, created_by=actor,
        )
        session.add(new_row)
        session.flush()
        result = _prompt_to_dict(new_row)
    write_audit(actor, "prompt.duplicate", "prompt", new_key, None, key)
    return result


# ── Audit log ────────────────────────────────────────────────────────────────

def write_audit(actor, action: str, entity_type: str, entity_id: str, old_value, new_value) -> None:
    with get_session() as session:
        session.add(SettingsAuditLog(
            actor=actor, action=action, entity_type=entity_type, entity_id=entity_id,
            old_value=old_value if old_value is None or isinstance(old_value, str) else json.dumps(old_value),
            new_value=new_value if new_value is None or isinstance(new_value, str) else json.dumps(new_value),
        ))


def list_audit_log(limit: int = 50, offset: int = 0) -> tuple[list[dict], int]:
    with get_session() as session:
        total = session.query(SettingsAuditLog).count()
        rows = (
            session.query(SettingsAuditLog)
            .order_by(SettingsAuditLog.id.desc())
            .offset(offset).limit(limit).all()
        )
        return [
            {
                "id": r.id, "actor": r.actor, "action": r.action,
                "entity_type": r.entity_type, "entity_id": r.entity_id,
                "old_value": r.old_value, "new_value": r.new_value,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ], total
