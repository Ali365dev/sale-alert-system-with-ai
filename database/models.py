from datetime import datetime, timezone


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Email(Base):
    __tablename__ = "emails"

    id = Column(Integer, primary_key=True, autoincrement=True)
    gmail_message_id = Column(String(255), unique=True, nullable=False, index=True)
    sender = Column(String(500), nullable=False)
    subject = Column(Text, nullable=False)
    body = Column(Text, nullable=True)
    image_urls = Column(Text, nullable=True)  # JSON array of image URLs found in the email
    received_date = Column(DateTime, nullable=True)
    processed_at = Column(DateTime, default=_utcnow, nullable=False)

    # AI email-level verification (content classification — legitimate/spam/etc.)
    email_verification_status = Column(String(20), nullable=True)   # "legitimate" | "suspicious" | "spam"
    email_verification_note = Column(Text, nullable=True)
    email_verified_at = Column(DateTime, nullable=True)

    # AI offer-extraction processing status — independent of the verification
    # fields above. Exactly three states, no others.
    processing_status = Column(String(20), nullable=False, default="unprocessed", index=True)  # "unprocessed" | "processed" | "failed"
    processing_error = Column(Text, nullable=True)
    processing_attempted_at = Column(DateTime, nullable=True)

    offers = relationship("Offer", back_populates="email", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Email id={self.id} subject={self.subject[:40]!r}>"


class Brand(Base):
    __tablename__ = "brands"

    id           = Column(Integer, primary_key=True, autoincrement=True)
    name         = Column(String(255), unique=True, nullable=False, index=True)
    website      = Column(String(500), nullable=True)
    categories   = Column(Text, nullable=True)        # JSON array stored as text
    emails       = Column(Text, nullable=True)        # JSON array of known sender emails, stored as text
    is_active    = Column(Boolean, default=True, nullable=False)
    last_searched = Column(DateTime, nullable=True)
    created_at   = Column(DateTime, default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Brand id={self.id} name={self.name!r}>"


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email_id = Column(Integer, ForeignKey("emails.id"), nullable=True)

    brand = Column(String(255), nullable=True)
    company = Column(String(255), nullable=True)
    category = Column(String(255), nullable=True)
    subcategory = Column(String(255), nullable=True)
    offer_type = Column(String(255), nullable=True)
    discount_percentage = Column(Float, nullable=True)
    coupon_code = Column(String(100), nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    offer_value = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    key_highlights = Column(Text, nullable=True)   # JSON list stored as text
    website = Column(String(500), nullable=True)   # offer/brand URL
    is_active = Column(Boolean, default=True, nullable=False)
    source = Column(String(20), nullable=True)     # "email" | "ai"
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    # AI verification fields
    verification_status = Column(String(20), nullable=True)      # "verified" | "suspicious" | "invalid"
    verification_reason = Column(Text, nullable=True)
    verification_confidence = Column(Float, nullable=True)
    verified_at = Column(DateTime, nullable=True)

    email = relationship("Email", back_populates="offers")

    def __repr__(self) -> str:
        return f"<Offer id={self.id} brand={self.brand!r} discount={self.discount_percentage}%>"


class Job(Base):
    """Persisted background job — survives page refreshes and server restarts."""
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_type = Column(String(50), nullable=False, index=True)  # "email_sync" | "process_pending" | "verify_offers" | "fetch_sales_web" | "research_brands"
    status = Column(String(20), nullable=False, default="pending", index=True)
    # "pending" | "running" | "cancelling" | "completed" | "cancelled" | "failed"

    total_emails = Column(Integer, nullable=False, default=0)
    processed_emails = Column(Integer, nullable=False, default=0)
    successful = Column(Integer, nullable=False, default=0)
    failed = Column(Integer, nullable=False, default=0)
    skipped = Column(Integer, nullable=False, default=0)

    current_email_subject = Column(Text, nullable=True)
    progress_percentage = Column(Float, nullable=False, default=0.0)
    estimated_remaining_seconds = Column(Float, nullable=True)

    worker_count = Column(Integer, nullable=False, default=5)
    cancel_requested = Column(Boolean, nullable=False, default=False)
    error = Column(Text, nullable=True)

    # --- generic fields (used by every job type; email_sync writes both these
    # and the legacy *_emails fields above for back-compat) ---
    total_items = Column(Integer, nullable=False, default=0)
    processed_items = Column(Integer, nullable=False, default=0)
    current_item_label = Column(Text, nullable=True)
    stage = Column(Text, nullable=True)  # e.g. "collecting_work" | "processing" | "finalizing"

    payload = Column(Text, nullable=True)     # JSON: job_type-specific start params
    result = Column(Text, nullable=True)      # JSON: job_type-specific output stats
    checkpoint = Column(Text, nullable=True)  # JSON: {"last_item_id": ..., "last_item_label": ...} — display only

    is_interrupted = Column(Boolean, nullable=False, default=False)
    queue_position = Column(Integer, nullable=True)  # unused placeholder — reserved for a future real queue

    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    logs = relationship("JobLog", back_populates="job", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Job id={self.id} type={self.job_type!r} status={self.status!r}>"


class JobLog(Base):
    """A single activity-log line for a job, persisted so the log survives refreshes."""
    __tablename__ = "job_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    message = Column(Text, nullable=False)
    severity = Column(String(10), nullable=False, default="info")  # "info" | "success" | "warning" | "error"
    category = Column(String(30), nullable=True)  # e.g. "gmail" | "ai" | "offer" | "system"
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    job = relationship("Job", back_populates="logs")

    def __repr__(self) -> str:
        return f"<JobLog id={self.id} job_id={self.job_id} message={self.message[:40]!r}>"


class Setting(Base):
    """Generic scalar-config key/value store — model names, Gmail label,
    system prefs, email-processing knobs, admin password hash. Non-string
    values are JSON-serialized. New settings never need a schema migration."""
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)  # "providers" | "gmail" | "system" | "email_processing" | "auth"
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)
    updated_by = Column(String(100), nullable=True)

    def __repr__(self) -> str:
        return f"<Setting key={self.key!r}>"


class ApiKey(Base):
    """A single provider API key. Gemini supports multiple rows (priority-
    ordered rotation); Groq/Tavily are expected to have at most one."""
    __tablename__ = "api_keys"

    id = Column(Integer, primary_key=True, autoincrement=True)
    provider = Column(String(20), nullable=False, index=True)  # "gemini" | "groq" | "tavily"
    name = Column(String(100), nullable=False)
    encrypted_key = Column(Text, nullable=False)
    key_preview = Column(String(50), nullable=False)  # e.g. "AIza************XYZ" — display only, never decrypted

    priority = Column(Integer, nullable=False, default=0)
    is_enabled = Column(Boolean, nullable=False, default=True)
    status = Column(String(20), nullable=False, default="active")  # "active" | "disabled" | "invalid"

    daily_usage_count = Column(Integer, nullable=False, default=0)
    usage_reset_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, nullable=True)
    last_tested_at = Column(DateTime, nullable=True)
    last_test_ok = Column(Boolean, nullable=True)
    last_error = Column(Text, nullable=True)

    created_at = Column(DateTime, default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<ApiKey id={self.id} provider={self.provider!r} name={self.name!r}>"


class Prompt(Base):
    """An editable LLM prompt template. `default_content` is seeded once and
    powers "Restore Default"; `content` is what's actually used at runtime."""
    __tablename__ = "prompts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String(100), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(50), nullable=True)

    content = Column(Text, nullable=False)
    default_content = Column(Text, nullable=False)
    version = Column(Integer, nullable=False, default=1)

    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<Prompt key={self.key!r} version={self.version}>"


class SettingsAuditLog(Base):
    """Append-only record of every Settings mutation — who changed what,
    from what, to what, when."""
    __tablename__ = "settings_audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    actor = Column(String(100), nullable=True)
    action = Column(String(100), nullable=False)  # e.g. "api_key.create", "prompt.update"
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(String(50), nullable=True)
    old_value = Column(Text, nullable=True)  # JSON
    new_value = Column(Text, nullable=True)  # JSON
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SettingsAuditLog action={self.action!r} entity={self.entity_type}:{self.entity_id}>"
