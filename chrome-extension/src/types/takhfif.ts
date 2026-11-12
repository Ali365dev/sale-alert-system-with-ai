// Takhfif.app automated scraper types.
// KEEP THIS MODULE TYPE-ONLY: it is imported by the content script, the
// background service worker AND the popup. Any runtime export would make
// Rollup emit a shared chunk, which a classic content script cannot import.

export interface TakhfifListing {
  source: "takhfif";
  business_name: string;
  /** Absolute detail-page URL — the dedup key for businesses. */
  detail_url: string;
  cover_image?: string;
  logo_url?: string;
  rating?: number;
  discount_text?: string;
  discount_percentage?: number;
  bank_count?: number;
  category?: string;
  location?: string;
  review_count_text?: string;
  card_offer_count?: number;
  expiry_text?: string;
  listing_page: number;
  source_url: string;
  scraped_at: string;
}

/** What the content script returns for one listing page. */
export interface TakhfifPageResult {
  listings: TakhfifListing[];
  currentPage: number | null;
  totalPages: number | null;
  nextUrl: string | null;
  error?: string;
}

/** Configuration snapshot taken when a session starts. Mid-session option
 * changes apply to the NEXT session only. */
export interface TakhfifConfigSnapshot {
  scrapeAllPages: boolean;
  maxPages: number;
  detailsEnabled: boolean;
  delaySeconds: number;
  maxRetries: number;
  navTimeoutMs: number;
}

export type TakhfifPhase1Status =
  | "running" | "paused" | "completed" | "stopped" | "failed";

export interface TakhfifSession {
  sessionId: string;
  config: TakhfifConfigSnapshot;
  phase1: {
    status: TakhfifPhase1Status;
    currentPage: number;
    totalPages: number | null;
    pagesCompleted: number;
    discovered: number;
    saved: number;
    duplicates: number;
    failedPages: number[];
    /** URL still to be processed — set when paused/stopped, used by resume. */
    nextUrl: string | null;
    currentLabel: string;
    error: string | null;
    startedAt: string;
    finishedAt: string | null;
  };
  phase2: {
    /** disabled = toggle off · waiting = phase 1 not done · ready = queue
     * prepared, waiting for the user to manually start detail scraping. */
    status: "disabled" | "waiting" | "ready";
    queueSize: number;
  };
  updatedAt: string;
}

export interface TakhfifQueueItem {
  detailUrl: string;
  businessName: string;
  status: "pending" | "processing" | "completed" | "failed" | "skipped";
  retries: number;
  error: string | null;
}

export interface TakhfifLogEntry {
  time: string;
  level: "info" | "success" | "warn" | "error";
  message: string;
}
