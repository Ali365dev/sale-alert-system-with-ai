# Gmail AI Dashboard — Claude Code Rules

## Project structure

```
app/              ← React Native mobile app (Expo)
dashboard/        ← React + TypeScript admin dashboard (Vite)
app_server/       ← FastAPI: user-facing API (auth, brands, offers, preferences, sale alerts)
scraper_server/   ← FastAPI: admin API (analytics, emails, jobs, settings, scraping)
```

## Stack

### Backend (Python 3.12)
- **FastAPI** with **SQLAlchemy** (PostgreSQL via `DATABASE_URL`)
- **APScheduler** — background scheduler runs only on the app server
- **Gemini / Groq / Ollama** AI providers via `ai/` package
- **Firebase FCM** for push notifications (`services/push/fcm_client.py`)
- **Gmail OAuth2** for email ingestion (`gmail/`)
- Settings stored encrypted in DB (`services/settings_service.py`)

### Dashboard (TypeScript)
- **React + Vite** with **React Query** (`@tanstack/react-query`)
- **Axios** — two clients: `apiClient` (app server) and `scraperClient` (scraper server)
- All API calls go through `dashboard/src/api/*.ts` hooks

---

## Rules

@.claude/rules/server-routing.md

@.claude/rules/code-quality.md

@.claude/rules/ui-ux.md
