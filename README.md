# Gmail Sales Offers AI Dashboard

A production-ready Python application that reads Gmail emails from a `sales_offers` label, analyses them with Gemini AI, stores results in SQLite, and displays insights in a modern Streamlit dashboard.

---

## Tech Stack

| Layer | Library |
|---|---|
| Gmail integration | Google API Python Client (OAuth2) |
| AI analysis | Gemini 1.5 Flash (free tier) |
| Database | SQLite + SQLAlchemy 2 |
| Dashboard | Streamlit + Plotly |
| Scheduler | APScheduler |
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
# Edit .env — add GEMINI_API_KEY at minimum
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

### 5. Run the dashboard

```bash
streamlit run app.py
```

Open [http://localhost:8501](http://localhost:8501).  
Click **▶️ Run Fetch & Analyse Now** in the sidebar to do an immediate pass.

### 6. Run the scheduler (optional — for daily background fetching)

```bash
python scheduler/jobs.py
```

---

## Project Structure

```
gmail-ai-dashboard/
├── app.py               # Streamlit entry point
├── config.py            # All env-var settings + logging
├── dashboard/
│   ├── overview.py      # Metrics & latest offers
│   ├── analytics.py     # Charts & trend analysis
│   ├── search.py        # Filterable offer search + CSV export
│   └── insights.py      # Gemini daily digest & expiry alerts
├── gmail/
│   ├── gmail_client.py  # OAuth2 authentication
│   └── gmail_service.py # Fetch & deduplicate emails
├── ai/
│   └── analyzer.py      # Gemini prompt + JSON extraction
├── database/
│   ├── models.py        # SQLAlchemy ORM models
│   └── db.py            # Engine, session, init_db()
├── scheduler/
│   └── jobs.py          # APScheduler daily job
├── logs/                # Rotating log files
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

# systemd service for the dashboard
sudo tee /etc/systemd/system/gmail-dashboard.service > /dev/null <<EOF
[Unit]
Description=Gmail Offers Dashboard
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/gmail-dashboard
EnvironmentFile=/opt/gmail-dashboard/.env
ExecStart=/opt/gmail-dashboard/.venv/bin/streamlit run app.py --server.port=8501 --server.headless=true
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# systemd service for the scheduler
sudo tee /etc/systemd/system/gmail-scheduler.service > /dev/null <<EOF
[Unit]
Description=Gmail Offers Scheduler
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/opt/gmail-dashboard
EnvironmentFile=/opt/gmail-dashboard/.env
ExecStart=/opt/gmail-dashboard/.venv/bin/python scheduler/jobs.py
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now gmail-dashboard gmail-scheduler

# Monitor logs
journalctl -fu gmail-dashboard
```

### Docker

```bash
# First-time auth (must be done locally, not inside Docker)
python -c "from gmail.gmail_client import get_gmail_service; get_gmail_service()"
# This creates token.json — copy it to the server

# Build & run
docker compose up -d

# Logs
docker compose logs -f
```

### Cron alternative (instead of APScheduler)

```bash
# Add to crontab -e
0 8 * * * cd /opt/gmail-dashboard && .venv/bin/python -c "from scheduler.jobs import process_emails; process_emails()" >> logs/cron.log 2>&1
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
| `DATABASE_URL` | `sqlite:///gmail_offers.db` | SQLAlchemy URL |
| `SCHEDULER_HOUR` | `8` | Daily job hour (UTC) |
| `SCHEDULER_MINUTE` | `0` | Daily job minute |
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
docker compose logs -f scheduler
```

---

## Dashboard Pages

| Page | What you see |
|---|---|
| **Overview** | Headline metrics, top brands, latest 20 offers |
| **Analytics** | Bar / pie / histogram / line charts, sentiment breakdown |
| **Search** | Full-text filter by brand/subject/category/date, CSV export |
| **AI Insights** | Gemini daily digest, expiring deals, recommended actions |
