import os
import logging
import logging.handlers
import socket
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Force IPv4 for every outbound HTTPS call (Gmail, Gemini, Groq, Tavily, ...).
# On networks where IPv6 is DNS-advertised but actually blackholed (no code
# path, packets just vanish — common on some ISPs/routers/VPNs), Python's
# requests/urllib3 has no "happy eyeballs" fast-fallback like browsers do: it
# tries the IPv6 address first and waits out the full ~60s OS TCP-connect
# timeout before trying IPv4, which is exactly what turns "Connecting to
# Gmail…" into a multi-minute stall on every fresh process (each new
# connection pays this cost once). Forcing AF_INET here skips IPv6 entirely,
# so there's nothing to time out on. Set FORCE_IPV4=false to opt out on a
# network where IPv6 is known-good — must happen before any other module
# (which config.py is imported by almost first) makes its first connection.
if os.getenv("FORCE_IPV4", "true").lower() != "false":
    import urllib3.util.connection as _urllib3_cn

    _urllib3_cn.allowed_gai_family = lambda: socket.AF_INET

# ── Gmail ────────────────────────────────────────────────────────────────────
GMAIL_CREDENTIALS_FILE = os.getenv("GMAIL_CREDENTIALS_FILE", "credentials.json")
# Alternative to GMAIL_CREDENTIALS_FILE: the raw contents of credentials.json
# pasted directly into an env var. Preferred on hosts with no reliable place
# to mount a file (e.g. Render's free tier, where Secret File support is
# plan-dependent) — an env var always works. Checked first if set.
GMAIL_CREDENTIALS_JSON = os.getenv("GMAIL_CREDENTIALS_JSON", "")
GMAIL_TOKEN_FILE = os.getenv("GMAIL_TOKEN_FILE", "token.json")
GMAIL_LABEL = os.getenv("GMAIL_LABEL", "sales_offers")
# Brand-sender auto-labeling (services/jobs/label_brand_emails.py) applies this
# label to inbox messages whose sender matches a known brand email — same
# label the ingestion pipeline reads from (GMAIL_LABEL).
GMAIL_BRAND_LABEL = os.getenv("GMAIL_BRAND_LABEL", "sales_offers")
# .modify (not .readonly) is required to create/apply labels — if this scope
# was just widened, delete GMAIL_TOKEN_FILE once to force re-consent.
GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]
# How often services/scheduler.py::check_gmail_for_changes() polls as the
# backstop for the automatic new-email pipeline (services/jobs/
# email_automation.py) — a no-op when automatic_email_processing is off.
GMAIL_AUTOMATION_POLL_MINUTES = int(os.getenv("GMAIL_AUTOMATION_POLL_MINUTES", "5"))

# ── Gemini ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# ── Groq (fallback when Gemini is rate-limited) ───────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
# llama-3.3-70b-versatile was deprecated by Groq on 2026-08-16 — see
# https://console.groq.com/docs/deprecations.
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")

# ── Ollama (local Llama — final fallback) ─────────────────────────────────────
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set. Add it to your .env file (Supabase connection string).")

# ── Settings module ──────────────────────────────────────────────────────────
# Symmetric key used to encrypt API keys stored via the Settings page
# (services/settings_service.py). Generate one with:
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# The app still boots without this set — only API-key save/read in Settings
# will raise a clear error until it's provided.
SETTINGS_ENCRYPTION_KEY = os.getenv("SETTINGS_ENCRYPTION_KEY", "")
# Secret used to sign the admin session cookie for /api/settings/*.
SETTINGS_SESSION_SECRET = os.getenv("SETTINGS_SESSION_SECRET", SETTINGS_ENCRYPTION_KEY)

# ── Brand offer fetcher ───────────────────────────────────────────────────────
BRAND_CACHE_HOURS    = int(os.getenv("BRAND_CACHE_HOURS", "24"))
BRAND_BATCH_SIZE     = int(os.getenv("BRAND_BATCH_SIZE", "5"))
BRAND_SEARCH_RESULTS = int(os.getenv("BRAND_SEARCH_RESULTS", "5"))
BRAND_SEARCH_TIMEOUT = int(os.getenv("BRAND_SEARCH_TIMEOUT", "10"))
BRAND_AI_TIMEOUT     = int(os.getenv("BRAND_AI_TIMEOUT", "30"))
BRAND_RETRY_COUNT    = int(os.getenv("BRAND_RETRY_COUNT", "2"))
BRAND_DELAY_SECONDS  = float(os.getenv("BRAND_DELAY_SECONDS", "1.0"))

# ── OCR (image/GIF text extraction — ai/ocr.py) ───────────────────────────────
# Runs locally via PaddleOCR — no paid OCR API. Disable entirely with
# OCR_ENABLED=false; ai/ocr.py also degrades to a no-op (with a logged
# warning) if paddleocr/paddlepaddle aren't installed, so a missing/failed
# install never breaks the rest of the email-processing pipeline.
OCR_ENABLED           = os.getenv("OCR_ENABLED", "true").lower() == "true"
OCR_LANG              = os.getenv("OCR_LANG", "en")
OCR_MIN_CONFIDENCE    = float(os.getenv("OCR_MIN_CONFIDENCE", "0.5"))
# Images smaller than this (either dimension, in px) are treated as tracking
# pixels / icons / logos and skipped without running OCR on them.
OCR_MIN_IMAGE_SIZE    = int(os.getenv("OCR_MIN_IMAGE_SIZE", "40"))
OCR_GIF_FRAME_STEP    = int(os.getenv("OCR_GIF_FRAME_STEP", "5"))
OCR_MAX_GIF_FRAMES    = int(os.getenv("OCR_MAX_GIF_FRAMES", "8"))
OCR_MAX_WORKERS       = int(os.getenv("OCR_MAX_WORKERS", "4"))
OCR_DOWNLOAD_TIMEOUT  = int(os.getenv("OCR_DOWNLOAD_TIMEOUT", "10"))
OCR_MAX_IMAGES_PER_EMAIL = int(os.getenv("OCR_MAX_IMAGES_PER_EMAIL", "5"))
OCR_MAX_DOWNLOAD_BYTES  = int(os.getenv("OCR_MAX_DOWNLOAD_BYTES", str(15 * 1024 * 1024)))
# The PaddleOCR engine instance is shared and single-threaded-safe only, so
# every inference call serializes on one process-wide lock (ai/ocr.py). If a
# single pathological image (huge dimensions, corrupt data) makes the engine
# hang or run pathologically slowly, this bounds how long every OTHER caller
# will wait for that lock before giving up on OCR for their image and moving
# on, rather than blocking indefinitely — which previously froze OCR
# process-wide for as long as the stuck call ran (observed: hours).
OCR_INFERENCE_LOCK_TIMEOUT = int(os.getenv("OCR_INFERENCE_LOCK_TIMEOUT", "30"))

# ── Offer retention ──────────────────────────────────────────────────────────
# How long an offer stays in the database after it expires / after it was
# received (for offers with no detectable expiry date) before the daily
# cleanup job permanently deletes the row. Never touches the source Gmail
# message — see services/cleanup.py.
OFFER_RETENTION_AFTER_EXPIRY_DAYS = int(os.getenv("OFFER_RETENTION_AFTER_EXPIRY_DAYS", "7"))
OFFER_RETENTION_NO_EXPIRY_DAYS = int(os.getenv("OFFER_RETENTION_NO_EXPIRY_DAYS", "30"))
# Hour of day (UTC, 0-23) the daily cleanup job runs at.
OFFER_CLEANUP_HOUR_UTC = int(os.getenv("OFFER_CLEANUP_HOUR_UTC", "3"))

# ── App ───────────────────────────────────────────────────────────────────────
APP_TITLE = "Gmail Sales Offers AI Dashboard"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
LOG_FILE = os.getenv("LOG_FILE", "logs/app.log")


def setup_logging() -> logging.Logger:
    """Configure rotating file + console logging."""
    Path("logs").mkdir(exist_ok=True)
    logger = logging.getLogger("gmail_dashboard")
    logger.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Rotating file handler (5 MB × 3 backups)
    fh = logging.handlers.RotatingFileHandler(
        LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3
    )
    fh.setFormatter(fmt)

    ch = logging.StreamHandler()
    ch.setFormatter(fmt)

    if not logger.handlers:
        logger.addHandler(fh)
        logger.addHandler(ch)

    # Suppress SQLAlchemy's raw SQL output (echo=False on the engine isn't enough
    # when Streamlit or another library has already configured the root logger)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.pool").setLevel(logging.WARNING)

    return logger


logger = setup_logging()
