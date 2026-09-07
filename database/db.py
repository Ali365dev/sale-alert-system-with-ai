from contextlib import contextmanager
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from config import DATABASE_URL, logger
from database.models import Base


engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,   # test the connection before use — avoids errors/latency from a stale
                           # connection killed by the remote Postgres pooler's idle reaper
    pool_recycle=1800,    # recycle connections after 30 min so they never go stale mid-lifetime
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def _migrate() -> None:
    """Add new columns to existing tables without dropping data."""
    new_columns = [
        ("emails", "email_verification_status", "VARCHAR(20)"),
        ("emails", "email_verification_note",   "TEXT"),
        ("emails", "email_verified_at",          "TIMESTAMP"),
        ("offers", "source",                     "VARCHAR(20)"),
        ("brands", "emails",                     "TEXT"),
        ("emails", "image_urls",                 "TEXT"),
        ("jobs", "total_items",                  "INTEGER DEFAULT 0"),
        ("jobs", "processed_items",               "INTEGER DEFAULT 0"),
        ("jobs", "current_item_label",            "TEXT"),
        ("jobs", "stage",                         "TEXT"),
        ("jobs", "payload",                       "TEXT"),
        ("jobs", "result",                        "TEXT"),
        ("jobs", "checkpoint",                    "TEXT"),
        ("jobs", "is_interrupted",                "BOOLEAN DEFAULT FALSE"),
        ("jobs", "queue_position",                "INTEGER"),
        ("job_logs", "severity",                  "VARCHAR(10) DEFAULT 'info'"),
        ("job_logs", "category",                  "VARCHAR(30)"),
        ("emails", "processing_status",           "VARCHAR(20) DEFAULT 'unprocessed'"),
        ("emails", "processing_error",            "TEXT"),
        ("emails", "processing_attempted_at",     "TIMESTAMP"),
        ("emails", "ocr_text_raw",                "TEXT"),
        ("emails", "ocr_text_clean",              "TEXT"),
        ("emails", "ocr_processed_at",             "TIMESTAMP"),
        ("brands", "logo_url",                     "VARCHAR(500)"),
        ("brands", "description",                  "TEXT"),
        ("brands", "country",                       "VARCHAR(100)"),
        ("brands", "social_links",                   "TEXT"),
        ("offers", "expiry_date_basis",            "VARCHAR(20)"),
        ("offers", "expiry_date_confidence",       "FLOAT"),
        ("offers", "delete_after",                 "TIMESTAMP"),
        ("offers", "title",                        "VARCHAR(500)"),
        ("emails", "failure_reason",               "VARCHAR(60)"),
        ("emails", "failure_error_code",           "VARCHAR(20)"),
        ("emails", "failure_provider",             "VARCHAR(20)"),
        ("emails", "failure_key_identifier",       "VARCHAR(120)"),
        ("emails", "failure_attempt_count",        "INTEGER"),
        ("users", "firebase_uid",                  "VARCHAR(255)"),
        ("emails", "sale_relevance_score",          "FLOAT"),
        ("emails", "filter_status",                 "VARCHAR(20)"),
        ("emails", "filter_reason",                 "TEXT"),
    ]
    with engine.connect() as conn:
        for table, col, col_type in new_columns:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
                logger.info("Migration: added %s.%s", table, col)
                if (table, col) == ("emails", "processing_status"):
                    # Backfill from existing data, once, right after the column
                    # is first created: an email that already has offers clearly
                    # processed successfully in the past, even though we never
                    # stored that fact explicitly before this column existed.
                    conn.execute(text(
                        "UPDATE emails SET processing_status = 'processed' "
                        "WHERE id IN (SELECT DISTINCT email_id FROM offers WHERE email_id IS NOT NULL)"
                    ))
                    conn.commit()
                    logger.info("Migration: backfilled emails.processing_status from existing offers")
            except Exception:
                conn.rollback()  # column already exists — safe to skip

        try:
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_emails_processing_status ON emails (processing_status)"))
            conn.commit()
        except Exception:
            conn.rollback()

        # Make offers.email_id nullable so AI-generated offers don't need an email
        try:
            conn.execute(text("ALTER TABLE offers ALTER COLUMN email_id DROP NOT NULL"))
            conn.commit()
            logger.info("Migration: offers.email_id is now nullable")
        except Exception:
            conn.rollback()  # already nullable — safe to skip

        # Make users.password_hash nullable — a Google-only account (via
        # Firebase) never sets a password.
        try:
            conn.execute(text("ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL"))
            conn.commit()
            logger.info("Migration: users.password_hash is now nullable")
        except Exception:
            conn.rollback()  # already nullable — safe to skip

        try:
            conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_firebase_uid ON users (firebase_uid)"))
            conn.commit()
        except Exception:
            conn.rollback()

        # Add website column for offer/brand URL
        try:
            conn.execute(text("ALTER TABLE offers ADD COLUMN website VARCHAR(500)"))
            conn.commit()
            logger.info("Migration: added offers.website")
        except Exception:
            conn.rollback()  # already exists — safe to skip

        # Backfill offers.title from the linked email's subject for rows saved
        # before the column existed. Purely additive (only fills nulls, never
        # deletes/overwrites anything) — safe to run unconditionally every boot.
        try:
            conn.execute(text(
                "UPDATE offers SET title = "
                "(SELECT subject FROM emails WHERE emails.id = offers.email_id) "
                "WHERE title IS NULL AND email_id IS NOT NULL"
            ))
            conn.commit()
            logger.info("Migration: backfilled offers.title from linked email subjects")
        except Exception:
            conn.rollback()

        # Indexes on offers columns hit by filter/order_by/join in api/offers.py,
        # api/overview.py, api/search.py — these were previously unindexed,
        # forcing full sequential scans on every list/search/overview request.
        offer_indexes = [
            ("ix_offers_brand", "offers (brand)"),
            ("ix_offers_category", "offers (category)"),
            ("ix_offers_subcategory", "offers (subcategory)"),
            ("ix_offers_offer_type", "offers (offer_type)"),
            ("ix_offers_expiry_date", "offers (expiry_date)"),
            ("ix_offers_is_active", "offers (is_active)"),
            ("ix_offers_created_at", "offers (created_at)"),
            ("ix_offers_verification_status", "offers (verification_status)"),
            ("ix_offers_email_id", "offers (email_id)"),
            ("ix_offers_category_subcategory", "offers (category, subcategory)"),
            ("ix_offers_is_active_verification_status", "offers (is_active, verification_status)"),
            ("ix_offers_delete_after", "offers (delete_after)"),
        ]
        for index_name, index_target in offer_indexes:
            try:
                conn.execute(text(f"CREATE INDEX IF NOT EXISTS {index_name} ON {index_target}"))
                conn.commit()
            except Exception:
                conn.rollback()

    _backfill_delete_after()


def _backfill_delete_after() -> None:
    """One-time (idempotent) backfill for rows saved before offers.delete_after
    existed. Done in Python rather than raw SQL date arithmetic since that
    isn't portable between SQLite (dev) and Postgres (production) — see
    README's DATABASE_URL. Safe to call on every boot: only touches rows
    where delete_after is still null."""
    from database.models import Offer
    from database.offer_retention import compute_delete_after

    session = SessionLocal()
    try:
        rows = session.query(Offer).filter(Offer.delete_after.is_(None)).all()
        if not rows:
            return
        for o in rows:
            received_at = (o.email.received_date if o.email else None) or o.created_at
            o.delete_after = compute_delete_after(o.expiry_date, received_at)
        session.commit()
        logger.info("Migration: backfilled offers.delete_after for %d row(s)", len(rows))
    except Exception as exc:
        session.rollback()
        logger.error("offers.delete_after backfill failed: %s", exc)
    finally:
        session.close()


def _seed_brands() -> None:
    """Populate the brands table from brands.json if it is empty."""
    import json
    from pathlib import Path
    from database.models import Brand

    brands_file = Path(__file__).parent.parent / "brands.json"
    if not brands_file.exists():
        return

    session = SessionLocal()
    try:
        if session.query(Brand).count() > 0:
            return  # already seeded

        data = json.loads(brands_file.read_text(encoding="utf-8"))
        for b in data.get("brands", []):
            session.add(Brand(
                name=b["name"],
                website=b.get("website"),
                categories=json.dumps(b.get("categories", [])),
            ))
        session.commit()
        logger.info("Seeded %d brand(s) from brands.json", len(data.get("brands", [])))
    except Exception as exc:
        session.rollback()
        logger.error("Brand seed failed: %s", exc)
    finally:
        session.close()


def _seed_settings() -> None:
    """Seed the 6 default Prompt rows (from their hardcoded fallback
    constants) and default scalar Settings, only if each is missing —
    mirrors _seed_brands(). Safe to call on every boot."""
    from services import settings_service

    with SessionLocal() as session:
        from database.models import Prompt
        # Always run this loop, not just when the table is empty:
        # seed_prompt_if_missing() is already idempotent per-key, so this is
        # what lets a newly-added prompt (like brand_identification) actually
        # get seeded into a DB that was already initialized in the past.
        from ai.analyzer import _PROMPT_TEMPLATE as email_analysis_default, PROMPT_KEY as email_analysis_key
        from ai.verifier import (
            _VERIFY_PROMPT as offer_verification_default, OFFER_PROMPT_KEY as offer_verification_key,
            _EMAIL_VERIFY_PROMPT as email_verification_default, EMAIL_PROMPT_KEY as email_verification_key,
        )
        from ai.prompt_builder import _PROMPT as brand_research_ddg_default, PROMPT_KEY as brand_research_ddg_key
        from research.prompts import _PROMPT as brand_research_tavily_default, PROMPT_KEY as brand_research_tavily_key
        from app.api.routers.insights import _DIGEST_PROMPT as dashboard_digest_default, PROMPT_KEY as dashboard_digest_key
        from ai.brand_identifier import _PROMPT_TEMPLATE as brand_identification_default, PROMPT_KEY as brand_identification_key

        defaults = [
            (email_analysis_key, "Email Analysis", "Extracts structured offer data from a fetched email.", "email", email_analysis_default),
            (email_verification_key, "Email Classification", "Classifies a fetched email as legitimate, suspicious, or spam.", "email", email_verification_default),
            (offer_verification_key, "Offer Verification", "Verifies whether an extracted offer is genuine.", "offer", offer_verification_default),
            (brand_research_ddg_key, "Brand Research (Web Search)", "Extracts active promotions from DuckDuckGo search results for a brand.", "research", brand_research_ddg_default),
            (brand_research_tavily_key, "Brand Research (Tavily)", "Extracts active promotions from Tavily search results for a brand.", "research", brand_research_tavily_default),
            (dashboard_digest_key, "Dashboard Insights", "Generates the AI daily digest shown on the Insights page.", "insights", dashboard_digest_default),
            (brand_identification_key, "Brand Identification", "Identifies the brand behind an email that couldn't be auto-matched to a known brand's sender domain.", "email", brand_identification_default),
        ]
        for key, name, description, category, default_content in defaults:
            settings_service.seed_prompt_if_missing(key, name, description, category, default_content)

        # Per-key existence check (not "only if the whole table is empty") —
        # same reasoning as seed_prompt_if_missing() above: this is what lets
        # a newly-added setting (like ocr_max_images_per_email) actually get
        # seeded into a DB that was already initialized in the past, instead
        # of silently staying unset until someone opens Settings and re-saves.
        import secrets

        import config as _cfg
        defaults_kv = [
            ("gemini_model", _cfg.GEMINI_MODEL, "providers"),
            ("groq_model", _cfg.GROQ_MODEL, "providers"),
            ("gmail_label", _cfg.GMAIL_LABEL, "gmail"),
            ("gmail_brand_label", _cfg.GMAIL_BRAND_LABEL, "gmail"),
            ("timezone", "UTC", "system"),
            ("date_format", "YYYY-MM-DD", "system"),
            ("theme", "system", "system"),
            ("log_level", _cfg.LOG_LEVEL, "system"),
            ("max_emails_per_sync", 500, "email_processing"),
            ("retry_attempts", 3, "email_processing"),
            ("request_timeout_seconds", 60, "email_processing"),
            ("auto_analyze_emails", True, "email_processing"),
            ("auto_apply_gmail_label", True, "email_processing"),
            ("skip_already_labeled", True, "email_processing"),
            ("skip_duplicate_emails", True, "email_processing"),
            ("ocr_max_images_per_email", _cfg.OCR_MAX_IMAGES_PER_EMAIL, "email_processing"),
            # Automatic new-email pipeline (services/jobs/email_automation.py) —
            # off by default so it never activates on an existing deployment
            # without an explicit admin opt-in. gmail_webhook_secret is
            # generated once here and never regenerated (only used if the row
            # doesn't already exist, same as every other seed default).
            ("automatic_email_processing", False, "email_processing"),
            ("gmail_pubsub_topic", "", "gmail"),
            ("gmail_webhook_secret", secrets.token_urlsafe(32), "gmail"),
            ("gmail_last_history_id", "", "gmail"),
            ("gmail_watch_expiration", "", "gmail"),
        ]

        from ai.sale_filter import DEFAULT_STRONG_KEYWORDS, DEFAULT_WEAK_KEYWORDS

        defaults_kv.append(("sale_filter_weak_keywords", DEFAULT_WEAK_KEYWORDS, "sale_filter"))
        defaults_kv.append(("sale_filter_strong_keywords", DEFAULT_STRONG_KEYWORDS, "sale_filter"))
        seeded = 0
        for key, value, category in defaults_kv:
            if settings_service.get_setting(key) is None:
                settings_service.set_setting(key, value, category=category)
                seeded += 1
        if seeded:
            logger.info("Seeded %d default setting(s).", seeded)


def init_db() -> None:
    """Create all tables if they don't exist, then apply column migrations."""
    Base.metadata.create_all(bind=engine)
    _migrate()

    from services import job_service
    job_service.reconcile_interrupted_jobs()

    _seed_brands()
    _seed_settings()
    logger.info("Database initialized — all tables ready.")


@contextmanager
def get_session() -> Session:
    """Context manager that yields a session and handles commit / rollback."""
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
