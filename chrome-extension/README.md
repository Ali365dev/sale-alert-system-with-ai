# Deals More – Chrome Extension

A Chrome MV3 extension for extracting promotional offers from e-commerce websites and saving them to the Deals More backend.

## Development

```bash
cd chrome-extension
npm install
npm run build        # one-time build → dist/
npm run dev          # watch mode (rebuilds on save)
```

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `chrome-extension/dist/` folder

## Authentication

The extension uses the same admin password as the Deals More dashboard (`POST /api/settings/login`).

On first open, enter your admin password. The session is stored in `chrome.storage.local` and reused across browser restarts (7-day TTL).

To change the backend server URL, tap **Advanced settings** on the login screen.

## How it works

| Step | What happens |
|------|-------------|
| 1 | Open any e-commerce page |
| 2 | Click the Deals More icon |
| 3 | Tap **Scan This Page** |
| 4 | The content script runs 3 extraction stages: JSON-LD, Open Graph meta, DOM pattern scan |
| 5 | Extracted offers appear as selectable cards |
| 6 | Edit any offer inline before saving |
| 7 | Tap **Save selected offers** → `POST /api/offers` on app_server |
| 8 | Tap **Server** to queue a full server-side scrape via scraper_server |

## Backend endpoints used

| Endpoint | Server | Purpose |
|----------|--------|---------|
| `POST /api/settings/login` | app_server (8000) | Admin auth |
| `GET /api/settings/session` | app_server | Session check |
| `POST /api/settings/logout` | app_server | Sign out |
| `GET /api/brands` | app_server | Brand list |
| `POST /api/offers` | app_server | Save offer |
| `POST /api/offers/{id}/verify` | app_server | AI verification |
| `POST /api/website-scraper/scrape-now` | scraper_server (8001) | Server-side scrape |

## Extraction pipeline

1. **JSON-LD** — reads `<script type="application/ld+json">` Product/Offer schema
2. **Open Graph / meta** — reads `og:price`, `product:sale_price`, `og:image`, etc.
3. **DOM scan** — detects sale price elements, promo banners, coupon code blocks by CSS class patterns and keyword matching

Fields are never fabricated — if a value is not found on the page, the field is omitted.

## Project structure

```
chrome-extension/
├── manifest.json
├── popup.html
├── src/
│   ├── types/index.ts          — shared TypeScript interfaces
│   ├── background/
│   │   └── service-worker.ts   — routes messages between popup ↔ content
│   ├── content/
│   │   ├── content.ts          — injected into pages, runs extractors
│   │   └── extractors/         — JSON-LD, meta, DOM, dedup
│   ├── services/
│   │   ├── api.ts              — axios wrapper for both backend servers
│   │   └── storage.ts          — chrome.storage settings & session
│   ├── utils/
│   │   ├── price.ts            — price/discount/currency parsing
│   │   └── dedupe.ts           — offer deduplication
│   └── popup/
│       ├── App.tsx             — root component
│       ├── main.tsx
│       ├── components/
│       │   ├── LoginScreen.tsx
│       │   ├── ScanPanel.tsx
│       │   ├── OfferCard.tsx
│       │   ├── OfferList.tsx
│       │   ├── ProgressBar.tsx
│       │   └── Toast.tsx
│       └── styles/popup.css
└── public/icons/               — 16/48/128px icons
```
