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
    ]
    with engine.connect() as conn:
        for table, col, col_type in new_columns:
            try:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type}"))
                conn.commit()
                logger.info("Migration: added %s.%s", table, col)
            except Exception:
                conn.rollback()  # column already exists — safe to skip

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


def init_db() -> None:
    """Create all tables if they don't exist, then apply column migrations."""
    Base.metadata.create_all(bind=engine)
    _migrate()
    _seed_brands()
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
