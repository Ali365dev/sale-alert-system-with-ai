import os
import logging
import logging.handlers
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ── Gmail ────────────────────────────────────────────────────────────────────
GMAIL_CREDENTIALS_FILE = os.getenv("GMAIL_CREDENTIALS_FILE", "credentials.json")
GMAIL_TOKEN_FILE = os.getenv("GMAIL_TOKEN_FILE", "token.json")
GMAIL_LABEL = os.getenv("GMAIL_LABEL", "sales_offers")
# Brand-sender auto-labeling (services/jobs/label_brand_emails.py) applies this
# label to inbox messages whose sender matches a known brand email — same
# label the ingestion pipeline reads from (GMAIL_LABEL).
GMAIL_BRAND_LABEL = os.getenv("GMAIL_BRAND_LABEL", "sales_offers")
# .modify (not .readonly) is required to create/apply labels — if this scope
# was just widened, delete GMAIL_TOKEN_FILE once to force re-consent.
GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]

# ── Gemini ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

# ── Groq (fallback when Gemini is rate-limited) ───────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

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
OCR_MAX_IMAGES_PER_EMAIL = int(os.getenv("OCR_MAX_IMAGES_PER_EMAIL", "15"))
OCR_MAX_DOWNLOAD_BYTES  = int(os.getenv("OCR_MAX_DOWNLOAD_BYTES", str(15 * 1024 * 1024)))

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
