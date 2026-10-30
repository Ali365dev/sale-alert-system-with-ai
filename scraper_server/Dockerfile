FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Playwright Chromium for headless-browser scraping fallback.
RUN playwright install chromium --with-deps

COPY . .

RUN mkdir -p logs

RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
    CMD curl -f http://localhost:8001/api/health || exit 1

# Single worker — in-process scraping threads must not be forked.
CMD ["sh", "-c", "uvicorn scraper_server.main:app --host 0.0.0.0 --port ${PORT:-8001} --workers 1"]
