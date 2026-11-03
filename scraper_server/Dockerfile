# ── Stage 1: build deps ──────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libpq-dev libffi-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: runtime ─────────────────────────────────────────────────────────
FROM python:3.12-slim

# System deps for PaddleOCR, Playwright, and Camoufox
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl libpq5 libgl1 libglib2.0-0 libgomp1 \
    libsm6 libxext6 libxrender1 libx11-6 libxcb1 \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 \
    libcairo2 libpango-1.0-0 libgtk-3-0 fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Install Playwright browsers (Chromium) and Camoufox
RUN playwright install chromium --with-deps 2>/dev/null || true
RUN python -m camoufox fetch 2>/dev/null || true

# Copy source
COPY . .

RUN mkdir -p logs

# Non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8001/api/health || exit 1

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8001} --workers 1 --log-level ${LOG_LEVEL:-info}"]
