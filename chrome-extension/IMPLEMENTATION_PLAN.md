# Chrome Extension — Implementation Plan

## Audit Findings (Milestone 1)

### Working Functionality
- Auth: login/logout/session-check via `scraper_server :8001/api/settings`
- Content script 4-layer extraction (JSON-LD, meta, DOM, strikethrough)
- Visual CSS selector picker (hover overlay + tooltip)
- Scan Page → save offers to `app_server :8000/api/offers`
- Crawl Site → triggers `scraper_server /api/website-scraper/scrape-now`
- Settings tab: URL config, connection test
- Toast notifications
- Service worker message relay + dynamic content-script injection

### Broken / Missing
| Issue | File | Fix |
|---|---|---|
| `app_server` CORS missing `chrome-extension://*` | `app_server/main.py` | **Fixed** — added to allow_origin_regex |
| SelectorsTab saves to component state only — never persisted | `SelectorsTab.tsx` | Persist to `scraper_server /api/scraper-configs` |
| HistoryTab reads localStorage — not real backend jobs | `HistoryTab.tsx` | Replace with `scraper_server /api/jobs` |
| No brands list / brand scraping / brand discovery | — | Add BrandsTab (Milestones 3–6) |
| Progress percentage is fake (simulated animation) | `App.tsx` | Replace with real `job.progress_percentage` polling |
| Crawl `{ jobId }` typed wrong — server returns more fields | `types/index.ts` | Widen response type (non-breaking) |

### Available Backend APIs (all reused, none invented)

**App Server :8000**
- `GET  /api/brands` — full brand list with logo, country, website, scraping config
- `POST /api/brands` — create brand (admin auth required)
- `POST /api/offers` — save extracted offer

**Scraper Server :8001**
- `POST /api/website-scraper/scrape-now` — trigger scrape by `brand_id` or `url`
- `GET  /api/jobs/{id}` — single job with `progress_percentage`, `current_item_label`, `status`
- `GET  /api/jobs/{id}/logs` — job log lines
- `POST /api/jobs/{id}/cancel` — cancel a running job
- `GET  /api/jobs` — history list with `job_type`, `status` filters
- `POST /api/brand-discovery/start` — discover brand from website URL (async pipeline)
- `GET  /api/brand-discovery/{id}` — poll discovery result
- `GET  /api/scraper-configs` — list configs (optionally `?brand_id=X`)
- `POST /api/scraper-configs` — create config with start_urls + crawl limits
- `POST /api/scraper-configs/{id}/selectors` — save a CSS selector into a config

### Database Models (no changes needed)
- `Brand` — id, name, website, logo_url, country, is_active, last_searched, website_scraping_enabled
- `Offer` — standard offer fields, `source="chrome_extension"`
- `ScraperConfig` — per-brand CSS selector config with crawl limits
- `ScraperSelector` — individual selector node (text/image/link/price/attribute)
- `BrandDiscovery` — discovery run record (mode, query, status, discovered fields)
- `Job` — progress_percentage, processed_items, total_items, current_item_label, stage, error

---

## Architecture (Milestones 2–10, Bank Cards skipped)

### New Tab Structure
```
Bottom Nav: [🏪 Brands | 🎯 Selectors | 📋 History | ⚙ Settings]
```

### Brands Tab (primary mode)
```
Sub-nav: [List | Discover | Scan Page]
  List   → fetch /api/brands, select + scrape, job monitor
  Discover → extract current tab domain, check duplicates, quick-add or full discovery
  Scan Page → existing ScrapeTab (unchanged)
```

### Job Monitoring Strategy
- Active job ID stored in `chrome.storage.local` (key `active_job_id: number | null`)
- Popup polls `GET /api/jobs/{id}` every 4 seconds while open
- Survives popup close/reopen (ID persists in storage)
- Job clears from storage when status is `done|failed|cancelled`

### Selector Persistence
- SelectorsTab shows current domain (from active tab URL)
- On "Save to Config": finds or creates `ScraperConfig` for that brand/domain
- Saves each selector as a `ScraperSelector` via `POST /api/scraper-configs/{id}/selectors`

---

## File Changes Summary

### New files
- `src/services/brandsApi.ts` — listBrands, createBrand, triggerBrandScrape
- `src/services/jobsApi.ts` — getJob, listJobs, cancelJob, active job storage
- `src/popup/components/BrandsTab.tsx` — main brands tab (List/Discover/Scan sub-nav)
- `src/popup/components/BrandCard.tsx` — single brand row card
- `src/popup/components/DiscoverTab.tsx` — discover current site + manual add form
- `src/popup/components/JobStatusPanel.tsx` — active job progress banner

### Modified files
- `src/types/index.ts` — add Brand, Job, BrandSubTab types; rename TabId "scrape"→"brands"
- `src/popup/App.tsx` — new tab/sub-tab routing
- `src/popup/components/BottomNav.tsx` — "Scrape"→"Brands" tab label
- `src/popup/components/HistoryTab.tsx` — real job history from API
- `src/popup/components/SelectorsTab.tsx` — persist selectors to scraper-configs

### Unchanged files (content-script, extraction, service worker)
- `src/content/*` — all extractors, selector-mode, css-gen
- `src/background/service-worker.ts`
- `src/services/api.ts` (only additive changes via brandsApi.ts)
- `src/services/storage.ts`
- `src/popup/components/ScrapeTab.tsx`
- `src/utils/*`
