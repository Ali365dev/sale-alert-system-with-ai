import type { TakhfifBusinessDetail, TakhfifListing, TakhfifLogEntry, TakhfifSession } from "../types/takhfif";

// Storage keys also appear as string literals in the popup — the takhfif types
// module must stay type-only so content.js doesn't gain a shared import chunk.
export const KEYS = {
  session: "dm_takhfif_session",
  queue: "dm_takhfif_detail_queue",
  details: "dm_takhfif_details",
  logs: "dm_takhfif_logs",
} as const;

// NOTE: takhfif.app's robots.txt disallows /deals?… for crawlers. Paginated
// crawling is implemented at the user's explicit direction; the health layer
// keeps it sequential, slow, and pauses on any pushback (403/429/challenge).
export const LISTING_URL = "https://takhfif.app/deals";

export function urlForPage(page: number): string {
  return page <= 1 ? LISTING_URL : `${LISTING_URL}?page=${page}`;
}

export function get<T>(key: string): Promise<T | undefined> {
  return new Promise((res) => chrome.storage.local.get(key, (r) => res(r[key] as T | undefined)));
}

export function set(items: Record<string, unknown>): Promise<void> {
  return new Promise((res, rej) =>
    chrome.storage.local.set(items, () => {
      if (chrome.runtime.lastError) rej(new Error(chrome.runtime.lastError.message));
      else res();
    }),
  );
}

export async function log(level: TakhfifLogEntry["level"], message: string): Promise<void> {
  const logs = (await get<TakhfifLogEntry[]>(KEYS.logs)) ?? [];
  logs.unshift({ time: new Date().toLocaleTimeString("en-US", { hour12: false }), level, message });
  await set({ [KEYS.logs]: logs.slice(0, 300) });
}

export async function saveSession(s: TakhfifSession): Promise<void> {
  s.updatedAt = new Date().toISOString();
  await set({ [KEYS.session]: s });
}

export const normUrl = (u: string): string => u.replace(/\/+$/, "");

export function slugOf(url: string): string {
  return url.split("/place/")[1]?.split(/[/?#]/)[0] ?? normUrl(url);
}

type DetailsStore = Record<string, TakhfifBusinessDetail>;

/** Converts a TakhfifListing card into a minimal TakhfifBusinessDetail skeleton.
 * Phase 2 enriches these in place — existing full details are never overwritten. */
function listingToDetail(l: TakhfifListing): TakhfifBusinessDetail {
  const slug = slugOf(l.detail_url);
  return {
    source: "takhfif",
    slug,
    name: l.business_name,
    canonicalUrl: l.detail_url,
    category: l.category,
    city: l.location,
    rating: l.rating,
    reviewCountText: l.review_count_text,
    coverImage: l.cover_image,
    logoImage: l.logo_url,
    topDiscountText: l.discount_text,
    banks: [],
    branches: [],
    gallery: [],
    warnings: [],
    sourceUrl: l.detail_url,
    scrapedAt: l.scraped_at,
  };
}

/** Saves listings directly into the details store as partial business records,
 * deduplicating by slug. Never overwrites an existing entry that already has
 * bank data (phase 2 enriches those). Updates session counters. */
export async function appendListings(
  session: TakhfifSession, seen: Set<string>, incoming: TakhfifListing[],
): Promise<number> {
  const store = (await get<DetailsStore>(KEYS.details)) ?? {};
  let fresh = 0;

  for (const l of incoming) {
    const key = normUrl(l.detail_url);
    session.phase1.discovered++;
    if (seen.has(key)) { session.phase1.duplicates++; continue; }
    seen.add(key);
    const slug = slugOf(l.detail_url);
    // Only write if no entry exists yet — if phase 2 already ran for this slug, keep it
    if (!store[slug]) {
      store[slug] = listingToDetail(l);
    }
    session.phase1.saved++;
    fresh++;
  }

  if (fresh > 0) {
    await set({ [KEYS.details]: store });
  }
  return fresh;
}
