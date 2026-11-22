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
# Per-request cap for Gemini/Groq calls. Neither SDK times out by default
# (google-genai waits forever), so one stalled request used to hold an email
# for minutes — hours, in the worst logged case — instead of failing over.
LLM_REQUEST_TIMEOUT_SECONDS = float(os.getenv("LLM_REQUEST_TIMEOUT_SECONDS", "60"))

# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set. Add it to your .env file (Supabase connection string).")

# Render/Heroku often ship `postgres://…`. SQLAlchemy needs `postgresql://…`.
# Prefer the pinned psycopg2 driver — a bare `postgresql+psycopg://` URL
# (or SQLAlchemy defaulting to psycopg v3) raises ModuleNotFoundError: psycopg
# when only psycopg2-binary is installed.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://") :]
if DATABASE_URL.startswith("postgresql+psycopg://"):
    DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len("postgresql+psycopg://") :]
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = "postgresql+psycopg2://" + DATABASE_URL[len("postgresql://") :]


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
# OCR.space free plan (Engine 2). The key is the "ocr_space" entry in
# Settings → API keys; with no key (or OCR_ENABLED=false) OCR is a no-op and
# emails are analysed on subject+body alone. Local PaddleOCR used to run here,
# but its ~1 GB model kept OOM-killing Render's 2 GB instance.
OCR_ENABLED           = os.getenv("OCR_ENABLED", "true").lower() == "true"
# The free endpoint is shared and sometimes slow.
OCR_API_TIMEOUT       = int(os.getenv("OCR_API_TIMEOUT", "45"))
# Wider images (and every sampled GIF frame) are scaled down to this before
# upload — banner text stays readable and uploads stay under the 1 MB cap.
OCR_MAX_IMAGE_WIDTH   = int(os.getenv("OCR_MAX_IMAGE_WIDTH", "1600"))
OCR_MIN_CONFIDENCE    = float(os.getenv("OCR_MIN_CONFIDENCE", "0.5"))
# Images smaller than this (either dimension, in px) are treated as tracking
# pixels / icons / logos and skipped without running OCR on them.
OCR_MIN_IMAGE_SIZE    = int(os.getenv("OCR_MIN_IMAGE_SIZE", "40"))
OCR_GIF_FRAME_STEP    = int(os.getenv("OCR_GIF_FRAME_STEP", "5"))
# Sampled GIF frames are stacked into one image, so a GIF costs one OCR request.
OCR_MAX_GIF_FRAMES    = int(os.getenv("OCR_MAX_GIF_FRAMES", "6"))
# Kept low: the free plan rate-limits requests per hour.
OCR_MAX_WORKERS       = int(os.getenv("OCR_MAX_WORKERS", "2"))
OCR_DOWNLOAD_TIMEOUT  = int(os.getenv("OCR_DOWNLOAD_TIMEOUT", "10"))
OCR_MAX_IMAGES_PER_EMAIL = int(os.getenv("OCR_MAX_IMAGES_PER_EMAIL", "5"))
OCR_MAX_DOWNLOAD_BYTES  = int(os.getenv("OCR_MAX_DOWNLOAD_BYTES", str(15 * 1024 * 1024)))

# ── Offer retention ──────────────────────────────────────────────────────────
# How long an offer stays in the database after it expires / after it was
# received (for offers with no detectable expiry date) before the daily
# cleanup job permanently deletes the row. Never touches the source Gmail
# message — see services/cleanup.py.
OFFER_RETENTION_AFTER_EXPIRY_DAYS = int(os.getenv("OFFER_RETENTION_AFTER_EXPIRY_DAYS", "7"))
OFFER_RETENTION_NO_EXPIRY_DAYS = int(os.getenv("OFFER_RETENTION_NO_EXPIRY_DAYS", "30"))
# Hour of day (UTC, 0-23) the daily cleanup job runs at.
OFFER_CLEANUP_HOUR_UTC = int(os.getenv("OFFER_CLEANUP_HOUR_UTC", "3"))

# Personalized feed + FCM matching (services/offer_matching.py).
# "and" = brand AND at least one category must match.
# "or"  = brand match OR category match is enough (default) — with few
#         offers per brand, "and" tends to produce an empty feed/no
#         notifications even for users with real saved preferences (e.g. a
#         followed brand's only current offer falls in an unselected
#         category). "or" still personalizes, just less strictly.
# Empty brand/category selections never mean "all".
OFFER_MATCH_MODE = os.getenv("OFFER_MATCH_MODE", "or").strip().lower()
if OFFER_MATCH_MODE not in ("and", "or"):
    OFFER_MATCH_MODE = "or"

# ── Website Scraper ──────────────────────────────────────────────────────────
# services/website_scraper/ — HTTPX+Selectolax fetch/parse of a brand's own
# website (sale/offers/promo pages) to detect and create offers with
# source="website". See services/website_scraper/services.py for the pipeline.
WEBSITE_SCRAPER_ENABLED = os.getenv("WEBSITE_SCRAPER_ENABLED", "true").lower() == "true"
# Per-attempt HTTP / navigation timeout (httpx + Playwright goto).
WEBSITE_SCRAPE_TIMEOUT_SECONDS = float(os.getenv("WEBSITE_SCRAPE_TIMEOUT_SECONDS", "20"))
# Hard wall-clock budget for one URL across HTTPX → Chromium → Camoufox.
# When exhausted, remaining fallbacks are skipped so one dead site cannot
# stall "Scrape All".
WEBSITE_SCRAPE_FETCH_BUDGET_SECONDS = float(os.getenv("WEBSITE_SCRAPE_FETCH_BUDGET_SECONDS", "45"))
# Cap for a single browser fallback (Playwright / Camoufox), including launch.
WEBSITE_SCRAPE_BROWSER_TIMEOUT_SECONDS = float(
    os.getenv("WEBSITE_SCRAPE_BROWSER_TIMEOUT_SECONDS", "25")
)
WEBSITE_SCRAPE_MAX_PAGES = int(os.getenv("WEBSITE_SCRAPE_MAX_PAGES", "8"))
# After homepage + DB promo URLs, keep at most this many nav/footer/sale links.
WEBSITE_SCRAPE_TOP_DISCOVERED_LINKS = int(os.getenv("WEBSITE_SCRAPE_TOP_DISCOVERED_LINKS", "5"))
# Max hero/banner images to OCR on the homepage (reuses ai/ocr.py).
WEBSITE_SCRAPE_HERO_OCR_MAX_IMAGES = int(os.getenv("WEBSITE_SCRAPE_HERO_OCR_MAX_IMAGES", "4"))
# Cap concurrent *running* website_scrape_brand jobs. Extra scrape-now
# requests queue as pending and start when a slot frees (no more 429).
WEBSITE_SCRAPE_MAX_CONCURRENT = int(os.getenv("WEBSITE_SCRAPE_MAX_CONCURRENT", "5"))
WEBSITE_SCRAPE_REQUEST_DELAY_SECONDS = float(os.getenv("WEBSITE_SCRAPE_REQUEST_DELAY_SECONDS", "0.4"))
# Jobs with no progress update for this long are marked failed so the
# dashboard stops showing them as "running" forever after a hang.
WEBSITE_SCRAPE_STALE_MINUTES = int(os.getenv("WEBSITE_SCRAPE_STALE_MINUTES", "10"))
WEBSITE_SCRAPE_USER_AGENT = os.getenv(
    "WEBSITE_SCRAPE_USER_AGENT",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
)
# "needs_review"-tier (weak) signals still get an AI call by default — same
# reasoning ai/sale_filter.py uses: missing a real offer is worse than one
# extra AI call. Flip off to save tokens once the rule scorer is trusted.
WEBSITE_SCRAPE_AI_ON_WEAK_SIGNAL = os.getenv("WEBSITE_SCRAPE_AI_ON_WEAK_SIGNAL", "true").lower() == "true"
# Consecutive *successful* scrapes an active website offer can go missing
# from its source page before its closure_status escalates (see
# services/website_scraper/closure_detector.py). A failed HTTP request never
# counts toward these.
WEBSITE_MISSING_THRESHOLD_POSSIBLY_ENDED = int(os.getenv("WEBSITE_MISSING_THRESHOLD_POSSIBLY_ENDED", "2"))
WEBSITE_MISSING_THRESHOLD_EXPIRED = int(os.getenv("WEBSITE_MISSING_THRESHOLD_EXPIRED", "3"))

# ── Transactional email (password reset, etc.) ────────────────────────────────
# Optional SMTP. When unset, forgot-password falls back to the connected
# Gmail OAuth account (services/transactional_email.py). Set
# PASSWORD_RESET_DEV_ECHO=true only for local testing (returns `dev_code`
# in the API body) — never in production.
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM = os.getenv("SMTP_FROM", "").strip() or SMTP_USER
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() != "false"
PASSWORD_RESET_DEV_ECHO = os.getenv("PASSWORD_RESET_DEV_ECHO", "false").lower() == "true"
PASSWORD_RESET_CODE_TTL_MINUTES = int(os.getenv("PASSWORD_RESET_CODE_TTL_MINUTES", "15"))

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
