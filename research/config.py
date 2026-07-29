"""
Research module configuration.
All values come from the project .env file — no separate config file needed.
"""
import logging
import logging.handlers
import os
from pathlib import Path

from dotenv import load_dotenv

# Load from project root .env (one level up from research/)
load_dotenv(Path(__file__).parent.parent / ".env")

# ── Tavily ────────────────────────────────────────────────────────────────────
TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")
TAVILY_SEARCH_DEPTH: str = os.getenv("RESEARCH_TAVILY_DEPTH", "advanced")
TAVILY_MAX_RESULTS: int = int(os.getenv("RESEARCH_TAVILY_MAX_RESULTS", "10"))
TAVILY_TIMEOUT: int = int(os.getenv("RESEARCH_TAVILY_TIMEOUT", "30"))

# ── Ollama (local Llama) ──────────────────────────────────────────────────────
OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL: str = os.getenv("RESEARCH_OLLAMA_MODEL", os.getenv("OLLAMA_MODEL", "qwen2.5:3b"))
OLLAMA_TIMEOUT: int = int(os.getenv("RESEARCH_OLLAMA_TIMEOUT", "180"))

# ── Database (reuse existing Supabase connection string) ──────────────────────
DATABASE_URL: str = os.getenv("DATABASE_URL", "")

# ── Logging ───────────────────────────────────────────────────────────────────
LOG_LEVEL: str = os.getenv("RESEARCH_LOG_LEVEL", "INFO")
LOG_FILE: str = os.getenv("RESEARCH_LOG_FILE", "logs/research.log")


def get_logger() -> logging.Logger:
    """Return (or create) the research module logger."""
    logger = logging.getLogger("research")
    if logger.handlers:
        return logger  # already configured

    logger.setLevel(getattr(logging, LOG_LEVEL.upper(), logging.INFO))

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    Path("logs").mkdir(exist_ok=True)
    fh = logging.handlers.RotatingFileHandler(
        LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    fh.setFormatter(fmt)

    ch = logging.StreamHandler()
    ch.setFormatter(fmt)

    logger.addHandler(fh)
    logger.addHandler(ch)

    # Suppress SQLAlchemy noise
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    return logger


logger = get_logger()
