import type { TakhfifListing, TakhfifLogEntry, TakhfifSession } from "../types/takhfif";

// Storage keys also appear as string literals in the popup — the takhfif types
// module must stay type-only so content.js doesn't gain a shared import chunk.
export const KEYS = {
  session: "dm_takhfif_session",
  listings: "dm_takhfif_listings",
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
  return new Promise((res) => chrome.storage.local.set(items, () => res()));
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

/** Merges new listings into storage, deduplicating by normalized detail URL,
 * and updates the session's discovered/saved/duplicates counters. */
export async function appendListings(
  session: TakhfifSession, seen: Set<string>, incoming: TakhfifListing[],
): Promise<number> {
  const fresh: TakhfifListing[] = [];
  for (const l of incoming) {
    const key = normUrl(l.detail_url);
    if (seen.has(key)) { session.phase1.duplicates++; continue; }
    seen.add(key);
    fresh.push(l);
  }
  session.phase1.discovered += incoming.length;
  session.phase1.saved += fresh.length;
  if (fresh.length) {
    const existing = (await get<TakhfifListing[]>(KEYS.listings)) ?? [];
    await set({ [KEYS.listings]: existing.concat(fresh) });
  }
  return fresh.length;
}
