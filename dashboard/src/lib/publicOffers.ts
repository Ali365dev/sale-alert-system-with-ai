import type { Offer } from "../api/offers";
import { toast } from "../store/toastStore";

const DAY_MS = 24 * 60 * 60 * 1000;

export function humanize(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

export function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / DAY_MS);
}

export function isExpired(offer: Offer): boolean {
  const days = daysUntil(offer.expiry_date);
  return days !== null && days < 0;
}

export function isExpiringSoon(offer: Offer, withinDays = 3): boolean {
  const days = daysUntil(offer.expiry_date);
  return days !== null && days >= 0 && days <= withinDays;
}

export function isNewOffer(offer: Offer, withinDays = 7): boolean {
  if (!offer.created_at) return false;
  const days = (Date.now() - new Date(offer.created_at).getTime()) / DAY_MS;
  return days >= 0 && days <= withinDays;
}

export function expiryLabel(offer: Offer): string {
  const days = daysUntil(offer.expiry_date);
  if (days === null) return "No expiry";
  if (days < 0) return "Expired";
  if (days === 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  if (days <= 3) return `Expires in ${days} days`;
  return `Expires ${formatDate(offer.expiry_date)}`;
}

export function discountLabel(offer: Offer): string | null {
  if (offer.discount_percentage != null) return `${offer.discount_percentage}% OFF`;
  if (offer.offer_value) return offer.offer_value;
  return null;
}

export function hostnameOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function offerTypeIsFreeShipping(offer: Offer): boolean {
  return (offer.offer_type ?? "").toLowerCase().includes("free_shipping") || (offer.offer_type ?? "").toLowerCase().includes("free shipping");
}

export function offerTypeIsCashback(offer: Offer): boolean {
  return (offer.offer_type ?? "").toLowerCase().includes("cashback");
}

const CATEGORY_IMAGE_QUERIES: { match: RegExp; queries: string[] }[] = [
  { match: /fashion|apparel|clothing|retail/i, queries: ["photo-1483985988355-763728e1935b", "photo-1529139574466-a303027c1d8b", "photo-1542291026-7eec264c27ff", "photo-1584917865442-de89df76afd3"] },
  { match: /electronic|software|tech/i, queries: ["photo-1518770660439-4636190af475", "photo-1498049794561-7780e7231661", "photo-1505740420928-5e560c06d30e"] },
  { match: /beauty|cosmetic/i, queries: ["photo-1522335789203-aabd1fc54bc9", "photo-1596462502278-27bfdc403348", "photo-1608248543803-ba4f8c70ae0b"] },
  { match: /food|restaurant|grocery/i, queries: ["photo-1504674900247-0877df9cc836", "photo-1540189549336-e6e99c3679fe"] },
  { match: /travel/i, queries: ["photo-1436491865332-7a61a109cc05", "photo-1500530855697-b586d89ba3ee"] },
  { match: /sport|fitness/i, queries: ["photo-1517649763962-0c623066013b", "photo-1530549387789-4c1017266635", "photo-1542291026-7eec264c27ff"] },
  { match: /home|furniture/i, queries: ["photo-1484154218962-a197022b5858", "photo-1493663284031-b7e3aefcae8e", "photo-1616486338812-3dadae4b4ace"] },
  { match: /gaming|game/i, queries: ["photo-1550745165-9bc0b252726f", "photo-1593305841991-05c297ba4575"] },
];
const DEFAULT_IMAGE_QUERIES = [
  "photo-1483985988355-763728e1935b",
  "photo-1529139574466-a303027c1d8b",
  "photo-1542291026-7eec264c27ff",
  "photo-1498049794561-7780e7231661",
  "photo-1584917865442-de89df76afd3",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Category-relevant stock photography — offers have no real photography
 * stored in the backend. The seed chooses among a few on-theme images and
 * varies the crop so adjacent cards do not all repeat one photograph. */
export function imageForOffer(category: string | null | undefined, seed: string | null | undefined, width = 600, height = 400): string {
  const hint = `${category ?? ""} ${seed ?? ""}`;
  const match = CATEGORY_IMAGE_QUERIES.find((c) => c.match.test(hint));
  const h = hashString(seed ?? category ?? "deal");
  const photo = match?.queries[h % match.queries.length] ?? DEFAULT_IMAGE_QUERIES[h % DEFAULT_IMAGE_QUERIES.length];
  const fx = (0.3 + ((h & 0xff) % 41) / 100).toFixed(2);
  const fy = (0.3 + (((h >> 8) & 0xff) % 41) / 100).toFixed(2);
  return `https://images.unsplash.com/${photo}?w=${width}&h=${height}&q=75&fit=crop&crop=focalpoint&fp-x=${fx}&fp-y=${fy}&fp-z=1.3&auto=format`;
}

export async function copyToClipboard(text: string, successMessage = "Copied to clipboard."): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(successMessage);
  } catch {
    toast.error("Couldn't copy — copy it manually.");
  }
}

export async function shareOffer(title: string, url: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
    } catch {
      // user cancelled the native share sheet — no-op
    }
    return;
  }
  await copyToClipboard(url, "Link copied to clipboard.");
}

export interface CountEntry {
  name: string;
  count: number;
}

export function countBy(offers: Offer[], field: "brand" | "category"): CountEntry[] {
  const counts = new Map<string, number>();
  for (const o of offers) {
    const value = o[field];
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

const CHIP_TONES = ["brand", "success", "warning", "ai", "danger"] as const;
export type ChipTone = (typeof CHIP_TONES)[number];

export function toneForName(name: string): ChipTone {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return CHIP_TONES[hash % CHIP_TONES.length];
}

export const TONE_BG: Record<ChipTone, string> = {
  brand: "var(--brand-subtle)",
  success: "var(--success-subtle)",
  warning: "var(--warning-subtle)",
  ai: "var(--ai-subtle)",
  danger: "var(--danger-subtle)",
};

export const TONE_FG: Record<ChipTone, string> = {
  brand: "var(--brand)",
  success: "var(--success)",
  warning: "var(--amber-600)",
  ai: "var(--ai)",
  danger: "var(--red-600)",
};
