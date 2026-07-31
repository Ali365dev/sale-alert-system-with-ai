from contextlib import contextmanager
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from config import DATABASE_URL, logger
from database.models import Base


engine = create_engine(DATABASE_URL, echo=False)

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

        # Add website column for offer/brand URL
        try:
            conn.execute(text("ALTER TABLE offers ADD COLUMN website VARCHAR(500)"))
            conn.commit()
            logger.info("Migration: added offers.website")
        except Exception:
            conn.rollback()  # already exists — safe to skip


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
        if session.query(Prompt).count() == 0:
            from ai.analyzer import _PROMPT_TEMPLATE as email_analysis_default, PROMPT_KEY as email_analysis_key
            from ai.verifier import (
                _VERIFY_PROMPT as offer_verification_default, OFFER_PROMPT_KEY as offer_verification_key,
                _EMAIL_VERIFY_PROMPT as email_verification_default, EMAIL_PROMPT_KEY as email_verification_key,
            )
            from ai.prompt_builder import _PROMPT as brand_research_ddg_default, PROMPT_KEY as brand_research_ddg_key
            from research.prompts import _PROMPT as brand_research_tavily_default, PROMPT_KEY as brand_research_tavily_key
            from api.insights import _DIGEST_PROMPT as dashboard_digest_default, PROMPT_KEY as dashboard_digest_key

            defaults = [
                (email_analysis_key, "Email Analysis", "Extracts structured offer data from a fetched email.", "email", email_analysis_default),
                (email_verification_key, "Email Classification", "Classifies a fetched email as legitimate, suspicious, or spam.", "email", email_verification_default),
                (offer_verification_key, "Offer Verification", "Verifies whether an extracted offer is genuine.", "offer", offer_verification_default),
                (brand_research_ddg_key, "Brand Research (Web Search)", "Extracts active promotions from DuckDuckGo search results for a brand.", "research", brand_research_ddg_default),
                (brand_research_tavily_key, "Brand Research (Tavily)", "Extracts active promotions from Tavily search results for a brand.", "research", brand_research_tavily_default),
                (dashboard_digest_key, "Dashboard Insights", "Generates the AI daily digest shown on the Insights page.", "insights", dashboard_digest_default),
            ]
            for key, name, description, category, default_content in defaults:
                settings_service.seed_prompt_if_missing(key, name, description, category, default_content)
            logger.info("Seeded %d default prompt(s).", len(defaults))

        from database.models import Setting
        if session.query(Setting).count() == 0:
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
            ]
            for key, value, category in defaults_kv:
                settings_service.set_setting(key, value, category=category)
            logger.info("Seeded %d default setting(s).", len(defaults_kv))


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
