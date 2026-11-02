// ── Scraping / offer types ────────────────────────────────────────────────────

export interface ScrapedOffer {
  title: string;
  description?: string;
  brand?: string;
  product_name?: string;
  category?: string;
  subcategory?: string;
  discount_percentage?: number;
  original_price?: number;
  sale_price?: number;
  currency?: string;
  coupon_code?: string;
  image_url?: string;
  offer_url: string;
  source_url: string;
  expiry_date?: string;
  no_expiry: boolean;
  scraped_at: string;
  /** Local dedup key — not sent to backend */
  _key?: string;
}

export interface ExtractedPage {
  url: string;
  domain: string;
  offers: ScrapedOffer[];
  scrapedAt: string;
}

export interface ApiOffer {
  id: number;
  title: string | null;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  offer_type: string | null;
  discount_percentage: number | null;
  coupon_code: string | null;
  expiry_date: string | null;
  offer_value: string | null;
  website: string | null;
  summary: string | null;
  is_active: boolean;
  verification_status: string | null;
  image_url: string | null;
  source: string | null;
  source_url: string | null;
}

export interface SaveResult {
  offer: ApiOffer;
  alreadyExists: boolean;
}

// ── Brand types ───────────────────────────────────────────────────────────────

export interface Brand {
  id: number;
  name: string;
  website: string | null;
  logo_url: string | null;
  country: string | null;
  is_active: boolean;
  last_searched: string | null;
  website_scraping_enabled: boolean;
  categories: string[];
  homepage_url: string | null;
  sale_page_url: string | null;
}

// ── Job types (scraper_server /api/jobs) ──────────────────────────────────────

export type JobStatus = "pending" | "running" | "done" | "failed" | "cancelling" | "cancelled";

export interface Job {
  id: number;
  job_type: string;
  status: JobStatus;
  payload: Record<string, unknown> | null;
  error: string | null;
  progress_percentage: number | null;
  total_items: number | null;
  processed_items: number | null;
  successful: number | null;
  failed: number | null;
  current_item_label: string | null;
  stage: string | null;
  queue_position: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string | null;
}

/** State for tab-based browser scraping, stored in chrome.storage.local */
export interface TabScrapeState {
  active: boolean;
  cancelled: boolean;
  currentBrand: string;
  currentUrl: string;
  doneCount: number;
  totalCount: number;
  offersFound: number;
  offers: ScrapedOffer[];
}

export interface ScrapeNowResult {
  jobId: number;
  queued: boolean;
  status: string;
  active_count: number;
  max_concurrent: number;
}

// ── Navigation types ──────────────────────────────────────────────────────────

export type TabId = "brands" | "selectors" | "history" | "settings";
export type BrandSubTab = "list" | "discover" | "scan";

// ── Message types ─────────────────────────────────────────────────────────────

export type ScanStatus = "idle" | "scanning" | "done" | "error";

export interface ScrapeMessage {
  type: "SCRAPE_PAGE";
  url: string;
}

export interface ScrapeResponse {
  type: "SCRAPE_RESULT";
  offers: ScrapedOffer[];
  error?: string;
}

export interface SelectorMessage {
  type: "START_SELECTOR_MODE" | "STOP_SELECTOR_MODE" | "SELECTOR_PICKED" | "SELECTOR_MODE_CANCELLED";
  selector?: string;
  matches?: number;
  preview?: string;
  tag?: string;
  outerHtml?: string;
}

export type ExtensionMessage = ScrapeMessage | ScrapeResponse | SelectorMessage;

// ── App settings / misc ───────────────────────────────────────────────────────

export interface AppSettings {
  appServerUrl: string;
  scraperServerUrl: string;
  sessionToken: string | null;
}

export interface CrawlConfig {
  maxPages: number;
  depth: number;
  delay: number;
  maxOffers: number;
}

export interface ScrapeProgress {
  operation: string;
  percent: number;
  pagesVisited: number;
  offersDetected: number;
  offersProcessed: number;
  offersSaved: number;
}

export interface ScrapeHistoryEntry {
  id: string;
  url: string;
  domain: string;
  mode: "scan" | "crawl";
  offersFound: number;
  offersSaved: number;
  startedAt: string;
  status: "done" | "error";
}

export interface ConnectionStatus {
  appServer: "connected" | "error" | "unknown";
  scraperServer: "connected" | "error" | "unknown";
  lastChecked?: string;
}
