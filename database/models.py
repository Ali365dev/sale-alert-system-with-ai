from datetime import datetime, timezone


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)
from sqlalchemy import (
    Column, Integer, String, Text, Float, DateTime, ForeignKey, Boolean, UniqueConstraint
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

    # OCR text extracted from this email's images/GIFs (ai/ocr.py), kept separate
    # from `body` — never overwrites it. `ocr_text_raw` is every OCR engine
    # result concatenated as-is (debugging); `ocr_text_clean` is deduplicated
    # and whitespace-normalized, and is what gets merged with `body` and sent
    # to the offer-extraction AI (see services/jobs/process_pending.py).
    ocr_text_raw = Column(Text, nullable=True)
    ocr_text_clean = Column(Text, nullable=True)
    ocr_processed_at = Column(DateTime, nullable=True)

    # AI email-level verification (content classification — legitimate/spam/etc.)
    email_verification_status = Column(String(20), nullable=True)   # "legitimate" | "suspicious" | "spam"
    email_verification_note = Column(Text, nullable=True)
    email_verified_at = Column(DateTime, nullable=True)

    # AI offer-extraction processing status — independent of the verification
    # fields above. Exactly three states, no others.
    processing_status = Column(String(20), nullable=False, default="unprocessed", index=True)  # "unprocessed" | "processed" | "failed"
    processing_error = Column(Text, nullable=True)
    processing_attempted_at = Column(DateTime, nullable=True)

    # Structured detail behind the most recent processing_error, when the
    # failure came from the AI pipeline (ai.analyzer.analyze_email) — see
    # ai/providers.py's classify_error() for the failure_reason/error_code
    # taxonomy. All null for an email that hasn't failed, or failed for a
    # non-AI reason (e.g. routed to Unknown Emails).
    failure_reason = Column(String(60), nullable=True)          # e.g. "API rate limit exceeded"
    failure_error_code = Column(String(20), nullable=True)      # e.g. "429"
    failure_provider = Column(String(20), nullable=True)        # e.g. "Gemini" — display name, not raw provider key
    failure_key_identifier = Column(String(120), nullable=True)  # e.g. "Gemini Key 1" — never the raw API key
    failure_attempt_count = Column(Integer, nullable=True)

    # Pre-AI sale-content relevance filter (ai/sale_filter.py) — scored from
    # subject + body + ocr_text_clean right after OCR, before the AI offer-
    # extraction call. Only "not_sale_related" actually skips that call;
    # "needs_review" still goes to full analysis (safer against missing a
    # real deal worded ambiguously) and is tagged here purely for visibility.
    sale_relevance_score = Column(Float, nullable=True)
    filter_status = Column(String(30), nullable=True)  # "eligible_for_analysis" | "needs_review" | "not_sale_related"
    filter_reason = Column(Text, nullable=True)

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

    logo_url     = Column(String(500), nullable=True)
    description  = Column(Text, nullable=True)
    country      = Column(String(100), nullable=True)
    social_links = Column(Text, nullable=True)        # JSON object stored as text, e.g. {"instagram": "..."}

    def __repr__(self) -> str:
        return f"<Brand id={self.id} name={self.name!r}>"


class BrandCandidate(Base):
    """A lightweight review-queue row for an email the pipeline couldn't
    confidently match to a known brand (analyze_email() returned brand=None).
    References Email by FK — never duplicates subject/body/ocr_text/
    attachments; the API joins back to Email for those. One row per Email
    routed here (email_id is unique — re-analysis updates the same row)."""
    __tablename__ = "brand_candidates"

    id       = Column(Integer, primary_key=True, autoincrement=True)
    email_id = Column(Integer, ForeignKey("emails.id"), nullable=False, unique=True, index=True)

    status = Column(String(20), nullable=False, default="pending", index=True)
    # "pending" | "analyzed" | "resolved" | "ignored"

    sender_domain = Column(String(255), nullable=True, index=True)

    # AI suggestion fields (populated by ai/brand_identifier.py)
    suggested_name     = Column(String(255), nullable=True)
    suggested_website   = Column(String(500), nullable=True)
    suggested_category   = Column(String(255), nullable=True)
    suggested_logo_url   = Column(String(500), nullable=True)
    suggested_country    = Column(String(100), nullable=True)
    suggested_socials    = Column(Text, nullable=True)   # JSON: {"instagram": "...", ...}
    confidence            = Column(Float, nullable=True)   # 0.0 - 1.0
    reasoning              = Column(Text, nullable=True)
    analyzed_at             = Column(DateTime, nullable=True)
    analysis_error          = Column(Text, nullable=True)

    # Deterministic duplicate-check result (see services/jobs/discover_brand.py)
    possible_duplicate_brand_id = Column(Integer, ForeignKey("brands.id"), nullable=True)
    duplicate_match_score       = Column(Float, nullable=True)
    duplicate_match_reason      = Column(String(50), nullable=True)  # "domain_match" | "name_fuzzy_match"

    # Resolution outcome
    resolved_brand_id = Column(Integer, ForeignKey("brands.id"), nullable=True)
    resolved_at        = Column(DateTime, nullable=True)
    resolved_by         = Column(String(100), nullable=True)

    created_at = Column(DateTime, default=_utcnow, nullable=False, index=True)

    email = relationship("Email")

    def __repr__(self) -> str:
        return f"<BrandCandidate id={self.id} email_id={self.email_id} status={self.status!r}>"


class BrandDiscovery(Base):
    """One admin-initiated Brand Discovery run (services/brand_discovery/,
    services/jobs/brand_discovery.py) — the mirror image of BrandCandidate,
    but triggered by an admin searching a brand name or pasting a website
    URL instead of an unmatched email arriving. No email_id: this flow never
    involves an Email row."""
    __tablename__ = "brand_discoveries"

    id = Column(Integer, primary_key=True, autoincrement=True)

    mode  = Column(String(20), nullable=False)   # "search_name" | "scan_website"
    query = Column(Text, nullable=False)         # the brand name or URL the admin entered

    # Set when this discovery was started from a BrandRequest's "Discover"
    # button (dashboard/src/pages/BrandRequests.tsx) — on save, that request
    # is automatically marked "added" (app/api/routers/brand_discovery.py's
    # save_discovery). Null for a discovery started directly from the
    # Discover Brand page with no originating request.
    brand_request_id = Column(Integer, ForeignKey("brand_requests.id"), nullable=True)

    status = Column(String(20), nullable=False, default="pending", index=True)
    # "pending" | "discovering" | "review" | "saved" | "discarded" | "failed"

    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)

    # Discovered/edited brand fields — same shape as Brand's own columns,
    # plus subcategory (Brand has none; folded into Brand.categories on save).
    name        = Column(String(255), nullable=True)
    website     = Column(String(500), nullable=True)
    logo_url    = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    category    = Column(String(100), nullable=True)
    subcategory = Column(String(100), nullable=True)
    country     = Column(String(100), nullable=True)

    # Per-field provenance: {"name": "website_metadata", "logo_url": "website_metadata", ...}
    # — "official_website" | "search_result" | "website_metadata" | "website_footer" | "manual_entry".
    # An admin edit (PUT) flips that field's entry to "manual_entry".
    field_sources = Column(Text, nullable=True)

    # {"facebook": {"url": "...", "source": "website_footer", "verified": false}, ...}
    # — one entry per platform in facebook/instagram/tiktok/twitter/youtube/linkedin, only for
    # platforms actually discovered or manually added.
    social_links = Column(Text, nullable=True)

    confidence = Column(Float, nullable=True)  # 0.0-1.0, overall — see services/brand_discovery/pipeline.py

    # Deterministic duplicate-check result — same shape/reasons as BrandCandidate's,
    # plus "social_link_match" (services/brand_discovery/duplicate_detector.py).
    duplicate_brand_id = Column(Integer, ForeignKey("brands.id"), nullable=True)
    duplicate_score     = Column(Float, nullable=True)
    duplicate_reason    = Column(String(50), nullable=True)

    error = Column(Text, nullable=True)

    # Resolution outcome
    resolved_brand_id = Column(Integer, ForeignKey("brands.id"), nullable=True)
    resolved_at        = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=_utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<BrandDiscovery id={self.id} mode={self.mode!r} status={self.status!r}>"


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email_id = Column(Integer, ForeignKey("emails.id"), nullable=True, index=True)

    # The source email's subject line, preserved exactly as received — this is
    # the brand's own original promotional title, so it's used as the offer
    # title as-is (no AI-generated title, no sanitization). Null only for
    # offers with no source email (source="ai", web-scraped — see
    # services/jobs/fetch_sales_web.py).
    title = Column(String(500), nullable=True)
    brand = Column(String(255), nullable=True, index=True)
    company = Column(String(255), nullable=True)
    category = Column(String(255), nullable=True, index=True)
    subcategory = Column(String(255), nullable=True, index=True)
    offer_type = Column(String(255), nullable=True, index=True)
    discount_percentage = Column(Float, nullable=True)
    coupon_code = Column(String(100), nullable=True)
    expiry_date = Column(DateTime, nullable=True, index=True)
    # How expiry_date was determined — "explicit" (a calendar date was stated),
    # "relative" (resolved from wording like "tomorrow"/"this weekend" using the
    # email's received_date), or "none" (no reliable expiration info; expiry_date
    # stays null — see database/offer_retention.py, never guessed).
    expiry_date_basis = Column(String(20), nullable=True)
    expiry_date_confidence = Column(Float, nullable=True)
    # Retention cutoff, computed once at creation (database/offer_retention.py)
    # and never recomputed per-request. The daily cleanup job (services/cleanup.py)
    # deletes the row once this is reached — see config.OFFER_RETENTION_*_DAYS.
    delete_after = Column(DateTime, nullable=True, index=True)
    offer_value = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    key_highlights = Column(Text, nullable=True)   # JSON list stored as text
    website = Column(String(500), nullable=True)   # offer/brand URL
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    source = Column(String(20), nullable=True)     # "email" | "ai" | "social"
    created_at = Column(DateTime, default=_utcnow, nullable=False, index=True)

    # AI verification fields
    verification_status = Column(String(20), nullable=True, index=True)      # "verified" | "suspicious" | "invalid"
    verification_reason = Column(Text, nullable=True)
    verification_confidence = Column(Float, nullable=True)
    verified_at = Column(DateTime, nullable=True)

    email = relationship("Email", back_populates="offers")

    def __repr__(self) -> str:
        return f"<Offer id={self.id} brand={self.brand!r} discount={self.discount_percentage}%>"


class SocialPost(Base):
    """One Facebook/Instagram post submitted to the Social Media Offer
    Discovery pipeline (services/social_scraper/content_pipeline.py) —
    either tied to a Brand (submitted from the Offer Discovery page) or
    ad-hoc (submitted from the Social Scraper Test page, brand_id null).

    No automated fetch happens for this feature — see services/social_scraper/
    post_metadata_fetcher.py's docstring for why (Meta ToS: there's no way to
    list a profile's posts without either login, which isn't built, or an
    official API grant, which needs the brand's own cooperation). caption/
    image_url/post_date are admin-supplied (optionally best-effort auto-filled
    from the post's own public og: preview tags for a *specific* URL, same
    mechanism a chat app's link-unfurl uses — not profile scraping)."""
    __tablename__ = "social_posts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=True, index=True)

    platform = Column(String(20), nullable=False)  # "facebook" | "instagram"
    post_url = Column(String(500), unique=True, nullable=False, index=True)  # dedup key
    caption = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    post_date = Column(DateTime, nullable=True)  # as supplied/detected — not always known

    ocr_text = Column(Text, nullable=True)

    # Keyword-based scoring (ai/sale_filter.py, reused verbatim) — cheap
    # first pass so the AI call below is skipped for clear non-offers.
    keyword_score = Column(Float, nullable=True)
    keyword_status = Column(String(30), nullable=True)  # eligible_for_analysis | needs_review | not_sale_related
    keyword_reason = Column(Text, nullable=True)

    ai_result = Column(Text, nullable=True)  # JSON — full ai/social_offer_analyzer.py response, for review/debug

    offer_id = Column(Integer, ForeignKey("offers.id"), nullable=True)

    status = Column(String(20), nullable=False, default="pending", index=True)
    # "pending" | "processing" | "processed" | "failed"
    error = Column(Text, nullable=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True)

    scraped_at = Column(DateTime, default=_utcnow, nullable=False)  # when submitted/discovered
    created_at = Column(DateTime, default=_utcnow, nullable=False, index=True)

    def __repr__(self) -> str:
        return f"<SocialPost id={self.id} platform={self.platform!r} status={self.status!r}>"


class SocialScrapeLog(Base):
    """Per (brand, platform) scrape history — one row per pair, updated on
    every submission through that brand's Facebook/Instagram source (Offer
    Discovery page). Never touched by ad-hoc Social Scraper Test submissions
    (those have no brand_id)."""
    __tablename__ = "social_scrape_logs"
    __table_args__ = (UniqueConstraint("brand_id", "platform", name="uq_social_scrape_log_brand_platform"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    brand_id = Column(Integer, ForeignKey("brands.id"), nullable=False, index=True)
    platform = Column(String(20), nullable=False)  # "facebook" | "instagram"

    last_scraped_at = Column(DateTime, nullable=True)
    last_post_url = Column(String(500), nullable=True)
    status = Column(String(20), nullable=False, default="never_run")  # "success" | "failed" | "never_run"
    error_message = Column(Text, nullable=True)
    posts_checked = Column(Integer, nullable=False, default=0)
    offers_created = Column(Integer, nullable=False, default=0)

    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<SocialScrapeLog brand_id={self.brand_id} platform={self.platform!r} status={self.status!r}>"


class Job(Base):
    """Persisted background job — survives page refreshes and server restarts."""
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_type = Column(String(50), nullable=False, index=True)  # "email_sync" | "process_pending" | "verify_offers" | "fetch_sales_web" | "research_brands" | "cleanup_expired_offers"
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


class EmailAutomationRun(Base):
    """Idempotency guard for the automatic new-email pipeline (services/jobs/
    email_automation.py) — one row per Gmail message a run has ever claimed.
    The unique constraint on gmail_message_id is what makes a duplicate
    webhook delivery or an overlapping scheduler-backstop poll a guaranteed
    DB-level no-op: collect_work() inserts a row here before process_item()
    touches that message, so a second trigger covering the same message
    can't claim it twice. The actual pipeline state (stage/logs/timestamps)
    lives on the linked Job row — see services/jobs/base.py — this table is
    deliberately just the claim, not a second job-tracking schema."""
    __tablename__ = "email_automation_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    gmail_message_id = Column(String(255), unique=True, nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<EmailAutomationRun gmail_message_id={self.gmail_message_id!r} job_id={self.job_id}>"


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


class DeviceToken(Base):
    """A single mobile device's FCM registration token — the push audience
    for services/jobs/send_push_notification.py. Broadcast-only for now (no
    user/account model exists yet): every active row gets every send."""
    __tablename__ = "device_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String(500), unique=True, nullable=False, index=True)
    platform = Column(String(10), nullable=False)  # "ios" | "android"
    is_active = Column(Boolean, default=True, nullable=False, index=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    last_seen_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<DeviceToken id={self.id} platform={self.platform!r} active={self.is_active}>"


class UserProfile(Base):
    """A device's onboarding interests (brands/categories chosen to follow),
    keyed by a client-generated device_id — independent of DeviceToken.token
    (the FCM push token) so preferences survive even when push permission is
    denied or a token rotates. `user_id` stays null until real accounts exist;
    logging in later just fills it in on the same row rather than requiring a
    new table."""
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(255), unique=True, nullable=False, index=True)
    user_id = Column(String(255), nullable=True, index=True)

    brands = Column(Text, nullable=True)      # JSON array of brand names, stored as text
    categories = Column(Text, nullable=True)  # JSON array of category names, stored as text

    created_at = Column(DateTime, default=_utcnow, nullable=False)
    updated_at = Column(DateTime, default=_utcnow, onupdate=_utcnow, nullable=False)

    def __repr__(self) -> str:
        return f"<UserProfile id={self.id} device_id={self.device_id!r}>"


class User(Base):
    """A real mobile-app account — email + password, and/or Google via
    Firebase (firebase_uid) — optional; guest/device mode
    (UserProfile.device_id) keeps working independently. Signing up or
    logging in on a device links that device's existing UserProfile row to
    this user (UserProfile.user_id = str(User.id)) rather than creating a
    parallel preferences record, so followed brands/favorite categories
    carry over from guest use — see services/user_auth.py,
    services/firebase_auth.py, and app/api/routers/auth.py.

    password_hash is nullable because a Google-only account never sets one;
    firebase_uid is nullable because a password-only account never gets one
    — either can be set alone, or both (a password account that later also
    signs in with Google under the same email gets firebase_uid backfilled
    onto its existing row rather than creating a duplicate account)."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)
    firebase_uid = Column(String(255), unique=True, nullable=True, index=True)
    name = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=_utcnow, nullable=False)
    last_login_at = Column(DateTime, nullable=True)

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email!r}>"


class BrandRequest(Base):
    """A user-initiated request for a brand not yet tracked by DealPulse —
    the mirror image of BrandCandidate (which is system/AI-detected from an
    unmatched email sender). Surfaced to admins as a review queue so demand
    for untracked brands is visible instead of anecdotal."""
    __tablename__ = "brand_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String(255), nullable=True, index=True)
    brand_name = Column(String(255), nullable=False)
    category = Column(String(255), nullable=True)
    note = Column(Text, nullable=True)

    status = Column(String(20), nullable=False, default="pending", index=True)
    # "pending" | "added" | "rejected"

    created_at = Column(DateTime, default=_utcnow, nullable=False, index=True)
    resolved_at = Column(DateTime, nullable=True)

    def __repr__(self) -> str:
        return f"<BrandRequest id={self.id} brand_name={self.brand_name!r} status={self.status!r}>"


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
