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
