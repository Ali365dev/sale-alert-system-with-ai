# Gmail Sales Offers AI Dashboard

A production-ready application that reads Gmail emails from a `sales_offers` label, analyses them with Gemini (Groq fallback) AI, stores results in a database, and exposes them through a Flask API consumed by a React dashboard.

---

## Tech Stack

| Layer | Library |
|---|---|
| Gmail integration | Google API Python Client (OAuth2) |
| AI analysis | Gemini (primary), Groq (fallback) |
| Database | SQLAlchemy 2 (SQLite locally, Postgres/Supabase in production) |
| API | Flask + Flask-CORS |
| Frontend | React + Vite + TypeScript, TanStack Query, Zustand |
| Config | python-dotenv |

---

## Quick Start (Local)

### 1. Clone & install

```bash
git clone <repo>
cd gmail-ai-dashboard
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env — add GEMINI_API_KEY and DATABASE_URL at minimum
```

### 3. Set up Gmail API

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project → enable **Gmail API**.
3. Create **OAuth 2.0 Client ID** (Desktop app) → download `credentials.json`.
4. Place `credentials.json` in the project root.
5. On first run the browser opens for consent; a `token.json` is saved automatically.

Create the Gmail label `sales_offers` in your Gmail account and filter promotional emails into it.

### 4. Get a Gemini API key

Visit [Google AI Studio](https://aistudio.google.com/app/apikey) → Create API key → paste into `.env`.

### 5. Run the API

```bash
python api_server.py
```

Serves the REST API on [http://localhost:8000](http://localhost:8000).

### 6. Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — the public offers site is at `/`, the admin dashboard at `/dashboard` (click **Run fetch & analyse now** in the sidebar, or use **Pipeline Center** to run/monitor any background job).

### 7. One-off manual pipeline run (optional)

```bash
python run.py
```

Fetches new emails, analyses them with AI, and saves offers — without going through the API/UI. Useful for cron or a quick manual catch-up.

---

## Project Structure

```
gmail-ai-dashboard/
├── api_server.py        # Flask entry point
├── api/                  # REST endpoints consumed by the React frontend
├── config.py             # All env-var settings + logging
├── frontend/              # React + Vite dashboard (public offers site + admin)
├── gmail/
│   ├── gmail_client.py   # OAuth2 authentication
│   └── gmail_service.py  # Fetch & deduplicate emails
├── ai/
│   ├── analyzer.py       # Gemini/Groq prompt + JSON extraction (per-email)
│   └── brand_fetcher.py  # AI-driven brand promotion discovery
├── services/
│   ├── email_sync.py     # Background job: fetch + analyse + save
│   └── jobs/              # Other background job types (verify, research, etc.)
├── database/
│   ├── models.py         # SQLAlchemy ORM models
│   └── db.py              # Engine, session, init_db()
├── research/               # Tavily + Llama brand research pipeline
├── run.py                 # Manual one-off pipeline runner
├── logs/                  # Rotating log files
├── .env.example
├── requirements.txt
├── Dockerfile
└── docker-compose.yml
```

---

## Deployment

### Ubuntu VPS

```bash
# Install Python 3.12
sudo apt update && sudo apt install -y python3.12 python3.12-venv

# Clone & install
git clone <repo> /opt/gmail-dashboard
cd /opt/gmail-dashboard
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Configure
cp .env.example .env && nano .env
# Place credentials.json and pre-generated token.json here

# systemd service for the API
sudo tee /etc/systemd/system/gmail-api.service > /dev/null <<EOF
[Unit]
Description=Gmail Offers API
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/gmail-dashboard
EnvironmentFile=/opt/gmail-dashboard/.env
ExecStart=/opt/gmail-dashboard/.venv/bin/python api_server.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now gmail-api

# Monitor logs
journalctl -fu gmail-api
```

Build the dashboard for production and serve `dashboard/dist/` from your web server of choice, pointed at the API's origin (`VITE_API_BASE_URL`, e.g. `https://your-api.example.com/api`):

```bash
cd dashboard && npm install && npm run build
```

### Docker

```bash
# First-time auth (must be done locally, not inside Docker)
python -c "from gmail.gmail_client import get_gmail_service; get_gmail_service()"
# This creates token.json — copy it to the server

# Build & run the API
docker compose up -d

# Logs
docker compose logs -f
```

The `docker-compose.yml` only runs the API — build and deploy the frontend separately (static hosting, CDN, or your own container).

### Render

`render.yaml` in the repo root is a ready-to-use Blueprint — Render builds from the existing `Dockerfile` directly, no separate buildpack config needed.

```bash
# First-time auth, same as Docker above (must be done locally — Render has no browser)
python -c "from gmail.gmail_client import get_gmail_service; get_gmail_service()"
# This creates token.json — you'll copy it onto the service's disk after first deploy (below)
```

1. Push this repo to GitHub (if not already), then in the Render dashboard: **New +** → **Blueprint** → select the repo. Render reads `render.yaml` and provisions the service.
2. During setup, Render prompts for every env var marked `sync: false` in `render.yaml`: `GEMINI_API_KEY`, `GROQ_API_KEY`, `DATABASE_URL` (your Supabase/Postgres connection string), and `ADDITIONAL_CORS_ORIGINS` (the deployed dashboard's origin, e.g. `https://your-dashboard.onrender.com` — required for Settings login to work from a browser). `SETTINGS_ENCRYPTION_KEY` is generated for you automatically; **never rotate it** once API keys have been saved through Settings, or they become unreadable.
3. Upload `credentials.json` as a **Secret File** (Dashboard → service → Environment → Secret Files) — it's never rewritten at runtime, so a read-only mount is fine.
4. `token.json` **is** rewritten on every OAuth refresh, so it needs to live on the writable disk the Blueprint provisions, not a Secret File. After the first deploy, open the service's **Shell** tab and copy the locally-generated `token.json` onto `/data/token.json`.
5. Pick at least the **Standard** plan, not Free — the OCR pipeline (`paddlepaddle`/`paddleocr`) needs real RAM, and Free-tier services spin down after 15 minutes idle, which would silently stop the daily offer-cleanup scheduler and any background sync job from ever completing.

Once it's live, point the mobile app's `EXPO_PUBLIC_API_URL` and the dashboard's `VITE_API_BASE_URL` (both `<render-url>/api`) at the Render service's `https://*.onrender.com` URL.

### Cron alternative (for periodic ingestion)

```bash
# Add to crontab -e
0 8 * * * cd /opt/gmail-dashboard && .venv/bin/python run.py >> logs/cron.log 2>&1
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `GMAIL_CREDENTIALS_FILE` | `credentials.json` | OAuth2 client secrets |
| `GMAIL_TOKEN_FILE` | `token.json` | Saved user token |
| `GMAIL_LABEL` | `sales_offers` | Gmail label to read |
| `GEMINI_API_KEY` | — | **Required** |
| `GEMINI_MODEL` | `gemini-1.5-flash` | Model name |
| `DATABASE_URL` | — | **Required** — SQLAlchemy connection string (Postgres/Supabase in production) |
| `LOG_LEVEL` | `INFO` | Python log level |
| `LOG_FILE` | `logs/app.log` | Rotating log path |

---

## Log Monitoring

```bash
# Live tail
tail -f logs/app.log

# Errors only
grep ERROR logs/app.log

# Docker
docker compose logs -f api
```

---

## Frontend Pages

| Route | What you see |
|---|---|
| `/` | Public offers site — browse, search, and filter deals |
| `/deals/:id`, `/deals/brand/:name` | Offer and brand detail pages |
| `/dashboard` | Admin overview — headline metrics, top brands, latest offers |
| `/analytics` | Charts and trend analysis |
| `/search` | Full-text filter by brand/subject/category/date |
| `/insights` | AI daily digest, expiring deals, recommended actions |
| `/offers`, `/brands`, `/emails` | Manager views for offers, brands, and raw emails |
| `/pipeline` | Background job monitor (email sync, verification, research, etc.) |
| `/settings` | API keys, prompts, Google account, email processing config |
