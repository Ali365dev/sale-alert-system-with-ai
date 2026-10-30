# Server Routing Rules

## Two-server split — never mix them up

| Server | Port | Who uses it | Routers |
|---|---|---|---|
| `app_server` | 8000 | Mobile app users | auth, brands, categories, offers, overview, search, preferences, sale_alerts, health |
| `scraper_server` | 8001 | Admin dashboard | analytics, insights, jobs, notifications, automation, settings, brand_requests, emails, unknown_emails, website_scraper, social_scraper, brand_discovery, health |

- **Never add an admin router to `app_server/main.py`** — admin routes belong in scraper_server.
- **Never add a user-facing router to `scraper_server/main.py`** — user data routes belong in app_server.
- The app server has a background scheduler (APScheduler). The scraper server does not — all scraper jobs are API-triggered.

## Dashboard Axios clients — always use the right one

```ts
import { apiClient } from "./client";        // app server  — user-facing routes
import { scraperClient } from "./client";    // scraper server — admin routes
```

### `apiClient` (app server)
Routes: `auth`, `brands`, `categories`, `offers`, `overview`, `search`, `preferences`, `sale-alerts`

### `scraperClient` (scraper server)
Routes: `analytics`, `insights`, `jobs`, `notifications`, `automation`, `settings`, `brand-requests`, `emails`, `unknown-emails`, `website-scraper`, `social-scraper`, `brand-discovery`

## API hooks (`dashboard/src/api/*.ts`)

- Every file in `dashboard/src/api/` must import from **only one client** — pick the correct one based on where that router lives.
- Files currently using `scraperClient`: `analytics.ts`, `insights.ts`, `jobs.ts`, `notifications.ts`, `settings.ts`, `brandRequests.ts`, `emails.ts`, `unknownEmails.ts`, `websiteScraper.ts`, `brandDiscovery.ts`, `socialScraper.ts`

## Page components that call `apiClient` directly

When a page component (under `dashboard/src/pages/`) makes direct Axios calls (not through a hook in `api/*.ts`), it **must import the matching client**:

```ts
// For admin/scraper routes:
import { scraperClient as apiClient } from "../api/client";

// For user-facing routes:
import { apiClient } from "../api/client";
```

- After adding or moving a router, grep `dashboard/src/pages/` for `import { apiClient }` and verify each usage targets the correct server.

## Adding a new router

1. Decide which server owns it (user-facing → app_server, admin → scraper_server).
2. Create `<server>/routers/<name>.py`.
3. Register it in `<server>/main.py`.
4. Create `dashboard/src/api/<name>.ts` importing the correct client.
5. If the router needs a service not yet in that server's `services/`, copy it in.

## Shared code between servers

Each server is **fully self-contained** — it has its own copy of `config.py`, `database/`, `ai/`, `core/`, `services/`. `sys.path.insert(0, str(Path(__file__).parent))` makes the server's own directory resolve first.

- Do not import cross-server (`from app_server.routers import ...` inside scraper_server).
- If both servers need the same service, copy the file into both `services/` directories.

## Keep-alive env vars (Render deployment)

- `app_server` reads `SCRAPER_SERVER_URL` to ping scraper every 10 min.
- `scraper_server` reads `APP_SERVER_URL` to ping app server every 10 min.
- Both are set in `render.yaml`. Do not remove them.
