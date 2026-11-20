# Server Routing Rules

## Two-server split — never mix them up

| Server | Port | Who uses it | Routers |
|---|---|---|---|
| `app_server` | 8000 | Mobile app users | auth, brands, categories, offers, overview, search, preferences, sale_alerts, bank_offers, health |
| `scraper_server` | 8001 | Admin dashboard + **every background job** | analytics, insights, jobs, notifications, automation, settings, brand_requests, emails, unknown_emails, website_scraper, social_scraper, brand_discovery, bank_offers, health |

- **`app_server` is pure CRUD.** It runs no background jobs, no scheduler, and has no `gmail/` fetch/watch code (`gmail_client.py` is the one exception — kept for transactional auth emails, see below). It never imports `jobs/`, `job_registry`, `services/job_runner.py`, or `services/job_service.py`.
- **`scraper_server` runs every job type** — the email ingestion pipeline (`email_sync`, `process_pending`, `email_automation`, `verify_offers`, `label_brand_emails`, `cleanup_expired_offers`, `check_sale_alerts`, `notify_matching_offer`, `send_push_notification`) as well as every scraping/research job. `job_registry.py` registers all of them; `main.py` runs the APScheduler (Gmail polling, offer cleanup, sale-alert checks) and mounts both `jobs` and `automation` (the Gmail Pub/Sub webhook).
- **Never add an admin or job-running router to `app_server/main.py`.**
- **Never add a user-facing CRUD router to `scraper_server/main.py`.**
- **The one cross-server call:** app_server's CRUD endpoints can create an `Offer` directly (`POST /offers`, `routers/brands.py`). `services/offer_notifications.py`'s SQLAlchemy hook still lives on app_server for that reason, but it triggers the actual notification job over HTTP — `POST {SCRAPER_SERVER_URL}/api/jobs/notify_matching_offer/start` with an `X-Internal-Secret` header matching the `internal_service_secret` setting (seeded once into the shared DB, same pattern as `gmail_webhook_secret`). `scraper_server/routers/jobs.py::_is_internal_caller` accepts that header as an alternative to the admin session cookie for the two admin-only job types. Never reuse that secret for anything end-user-facing.
- `GET` job endpoints (`/jobs`, `/jobs/summary`, `/jobs/active-all`, `/jobs/{id}`, `/jobs/{id}/logs`) only exist on `scraper_server` now — there's nothing to route by type.

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
