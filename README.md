# Sale Alert System with AI

A full-stack deal & bank card offer aggregation platform for Pakistan.

---

## 🌐 Production URLs

| Service | URL | Docs |
|---|---|---|
| **App Server** (user-facing API) | https://sale-alert-system-with-ai.onrender.com | [/docs](https://sale-alert-system-with-ai.onrender.com/docs) |
| **Scraper Server** (admin API) | https://sale-alert-system-with-ai-1.onrender.com | [/docs](https://sale-alert-system-with-ai-1.onrender.com/docs) |

## 🖥️ Local Development URLs

| Service | URL |
|---|---|
| App Server | http://localhost:8000 |
| Scraper Server | http://localhost:8001 |

---

## 📁 Project Structure

```
app/              — React Native mobile app (Expo)
dashboard/        — React + TypeScript admin dashboard (Vite)
app_server/       — FastAPI: user-facing API (auth, brands, offers, preferences, sale alerts)
scraper_server/   — FastAPI: admin API (analytics, emails, jobs, scraping, settings)
chrome-extension/ — Chrome extension for admin scraping
```

---

## 🚀 Running Locally

```bash
# Install Python deps
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Start both servers (hot reload)
bash run.sh
```

App server → http://localhost:8000/docs  
Scraper server → http://localhost:8001/docs

### Dashboard

```bash
cd dashboard
npm install
npm run dev     # http://localhost:5173
```

### Chrome Extension

```bash
cd chrome-extension
npm install
npm run build   # output in dist/
```
Load `dist/` as unpacked extension in Chrome → `chrome://extensions`.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and fill in the values.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `SETTINGS_ENCRYPTION_KEY` | ✅ | Fernet key — generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `GEMINI_API_KEY` | ✅ | [aistudio.google.com](https://aistudio.google.com) |
| `GROQ_API_KEY` | ✅ | [console.groq.com](https://console.groq.com) |
| `GMAIL_CREDENTIALS_JSON` | ✅ | Google OAuth credentials JSON (app server) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | ✅ | Firebase push notifications (app server) |
| `TAVILY_API_KEY` | ✅ | Web search for scraper (scraper server) |
| `APP_SERVER_URL` | prod | https://sale-alert-system-with-ai.onrender.com |
| `SCRAPER_SERVER_URL` | prod | https://sale-alert-system-with-ai-1.onrender.com |

---

## ☁️ Deploying to Render

Each server is its own Render project.

### App Server
1. Render → **New → Blueprint**
2. Connect repo → set **Root Directory**: `app_server`
3. Fill in secrets (`DATABASE_URL`, `GEMINI_API_KEY`, `GMAIL_CREDENTIALS_JSON`, etc.)

### Scraper Server
1. Render → **New → Blueprint**
2. Connect repo → set **Root Directory**: `scraper_server`
3. Fill in secrets (`DATABASE_URL`, `GEMINI_API_KEY`, `TAVILY_API_KEY`, etc.)

Both servers ping each other every 4 minutes to stay warm on the free plan.

---

## 📱 Stack

| Layer | Tech |
|---|---|
| Mobile App | React Native (Expo) |
| Admin Dashboard | React + Vite + TypeScript |
| Backend | FastAPI + SQLAlchemy (Python 3.12) |
| Database | PostgreSQL |
| AI | Gemini 2.0 Flash / Groq |
| Push Notifications | Firebase FCM |
| Email Ingestion | Gmail OAuth2 |
| Hosting | Render (Docker) |
