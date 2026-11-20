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
- **APScheduler** — background scheduler runs only on the scraper server (every background job runs there; the app server is pure CRUD)
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

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- When graphify-out/graph.json exists, run `graphify query "<question>"` before your first grep, search or source-file read for a codebase question, and put this rule in every subagent prompt that explores code. Read raw files only for lines the graph or an earlier read already located. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- A committed graphify-out/graph.json is rewritten whole on every build, so a large diff to it in a pull request is expected. Do not flag it as churn or suggest skipping the graph rebuild or its hooks.
