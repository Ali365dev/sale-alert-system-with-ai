#!/usr/bin/env bash
# Start both servers in parallel. Ctrl+C stops both.
set -e
cd "$(dirname "$0")"

trap 'kill 0' EXIT

echo "Starting app server on :8000 ..."
.venv/bin/uvicorn app_server.main:app --host 0.0.0.0 --port 8000 --reload --app-dir . &

echo "Starting scraper server on :8001 ..."
.venv/bin/uvicorn scraper_server.main:app --host 0.0.0.0 --port 8001 --reload --app-dir . &

wait
