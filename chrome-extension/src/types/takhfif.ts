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

/** Page-level health classification produced by the content script from the
 * real navigation state and page content — never used to bypass anything. */
export type TakhfifPageKind =
  | "ok" | "captcha" | "access_denied" | "rate_limited" | "server_error" | "empty";

export interface TakhfifPageHealth {
  httpStatus: number | null;
  kind: TakhfifPageKind;
  detail?: string;
  loadTimeMs?: number;
}

/** What the content script returns for one listing page. */
export interface TakhfifPageResult {
  listings: TakhfifListing[];
  currentPage: number | null;
  totalPages: number | null;
  nextUrl: string | null;
  health?: TakhfifPageHealth;
  error?: string;
}

/** Configuration snapshot taken when a session starts. Mid-session option
 * changes apply to the NEXT session only. */
export interface TakhfifConfigSnapshot {
  /** Follow pagination from startPage until the site has no next page. */
  scrapeAllPages: boolean;
  startPage: number;
  /** Inclusive last page when scrapeAllPages is off; null = until no next page. */
  endPage: number | null;
  detailsEnabled: boolean;
  delaySeconds: number;
  maxRetries: number;
  navTimeoutMs: number;
}

export type TakhfifHealthStatus =
  | "healthy" | "slow" | "rate_limited" | "access_restricted"
  | "verification_required" | "connection_error";

export interface TakhfifHealth {
  status: TakhfifHealthStatus;
  okLoads: number;
  failedLoads: number;
  rateLimitEvents: number;
  /** Adaptive delay — never drops below the configured minimum. */
  currentDelayMs: number;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export type TakhfifPhase1Status =
  | "running" | "paused" | "completed" | "stopped" | "failed";

export interface TakhfifSession {
  sessionId: string;
  config: TakhfifConfigSnapshot;
  health: TakhfifHealth;
  phase1: {
    status: TakhfifPhase1Status;
    /** Page currently being (or about to be) processed. */
    currentPage: number;
    /** Last page fully processed and saved — resume continues at +1, so an
     * interrupted page is retried, never skipped. */
    lastCompletedPage: number;
    /** Total paginated pages as reported by the site ("Page X of Y"). */
    totalPages: number | null;
    pagesCompleted: number;
    discovered: number;
    saved: number;
    duplicates: number;
    failedPages: number[];
    currentLabel: string;
    /** Why the session paused itself (health protection) — null when the
     * user paused manually. */
    pauseReason: string | null;
    error: string | null;
    startedAt: string;
    finishedAt: string | null;
  };
  phase2: {
    /** disabled = toggle off · waiting = phase 1 not done · ready = queue
     * prepared, waiting for the user to manually start detail scraping. */
    status: TakhfifPhase2Status;
    queueSize: number;
    processed: number;
    completedCount: number;
    failedCount: number;
    tiersFound: number;
    cardsFound: number;
    currentLabel: string;
    pauseReason: string | null;
  };
  updatedAt: string;
}

export type TakhfifPhase2Status =
  | "disabled" | "waiting" | "ready"
  | "running" | "paused" | "completed" | "stopped" | "failed";

/** Which queued businesses a detail run processes. */
export type TakhfifDetailMode = "new" | "existing" | "all" | "failed";

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

// ── Phase 2: business detail page ─────────────────────────────────────────────

export interface TakhfifBranch {
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  directionsUrl?: string;
  placeId?: string;
}

export interface TakhfifCard {
  cardName: string;
  discountPercentage: number | null;
  maxDiscountText?: string;
  maxDiscountAmount?: number;
  currency?: string;
  /** ISO date from the page's JSON-LD offer, when present. */
  validThrough?: string;
}

export interface TakhfifOfferTier {
  discountPercentage: number | null;
  title: string;
  cardsCountText?: string;
  cards: TakhfifCard[];
}

export interface TakhfifBankOffers {
  bankName: string;
  maxDiscountPercentage: number | null;
  bankPageUrl?: string;
  bankOfferUrl?: string;
  cardsAvailableText?: string;
  validityText?: string;
  terms: string[];
  tiers: TakhfifOfferTier[];
}

export interface TakhfifGalleryImage {
  url: string;
  alt?: string;
  order: number;
}

export interface TakhfifBusinessDetail {
  source: "takhfif";
  slug: string;
  name: string;
  canonicalUrl: string;
  category?: string;
  city?: string;
  description?: string;
  rating?: number;
  reviewCountText?: string;
  coverImage?: string;
  logoImage?: string;
  website?: string;
  phone?: string;
  priceLevel?: string;
  openingStatus?: string;
  closingTime?: string;
  openingHours?: { day: string; hours: string }[];
  topDiscountText?: string;
  totalBanks?: number;
  totalCards?: number;
  totalBranches?: number;
  facebookUrl?: string;
  instagramUrl?: string;
  mapsUrl?: string;
  branches: TakhfifBranch[];
  gallery: TakhfifGalleryImage[];
  menuPages?: number;
  banks: TakhfifBankOffers[];
  warnings: string[];
  sourceUrl: string;
  scrapedAt: string;
  /** Set when this record was saved to the backend (reviewed push). */
  pushedAt?: string;
}

/** What the content script returns for one detail page. */
export interface TakhfifDetailResult {
  detail: TakhfifBusinessDetail | null;
  health: TakhfifPageHealth;
  warnings: string[];
  error?: string;
}

// ── Standard import format (pushed to backend) ────────────────────────────────

export interface BusinessCard {
  card_name: string;
  discount_percentage: number | null;
  maximum_discount?: number | null;
  valid_days?: string;
  terms_and_conditions?: string;
  currency?: string;
}

export interface BusinessBank {
  bank_name: string;
  bank_logo?: string;
  cards: BusinessCard[];
}

export interface BusinessBranch {
  name?: string;
  address?: string;
  city?: string;
  area?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  opening_hours?: string;
  directions_url?: string;
  place_id?: string;
}

export interface BusinessDetail {
  business_id: string;
  name: string;
  category?: string;
  city?: string;
  description?: string;
  rating?: number;
  review_count?: number;
  phone?: string;
  website?: string;
  logo_url?: string;
  cover_image_url?: string;
  source_url?: string;
  banks: BusinessBank[];
  branches: BusinessBranch[];
}
