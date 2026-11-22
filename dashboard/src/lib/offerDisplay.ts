import type { Offer } from "../api/offers";
import { daysUntil, hostnameOf, humanize } from "./publicOffers";

/** Presentation helpers for AI-extracted offers, where brand, title, image
 * and expiry are frequently missing — every public surface should degrade to
 * something readable instead of "Unknown brand" / "Deal offer". */

function decodeEntities(url: string): string {
  return url.replace(/&amp;/g, "&");
}

function storeHost(offer: Offer): string | null {
  return hostnameOf(offer.website) ?? hostnameOf(offer.source_url) ?? hostnameOf(offer.image_url);
}

export function offerStoreName(offer: Offer): string | null {
  if (offer.brand) return offer.brand;
  if (offer.company) return offer.company;
  const host = storeHost(offer);
  if (!host) return null;
  const label = host.split(".").slice(-2, -1)[0] ?? host;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function offerStoreWebsite(offer: Offer): string | null {
  const host = storeHost(offer);
  return host ? `https://${host}` : null;
}

function firstSentence(text: string): string {
  return text.split(/(?<=[.!?])\s/)[0] ?? text;
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function offerHeadline(offer: Offer): string {
  const title = offer.title?.trim();
  if (title) return clip(title, 90);
  if (offer.summary) return clip(firstSentence(offer.summary), 90);
  if (offer.offer_value) return clip(offer.offer_value, 90);
  if (offer.discount_percentage != null) return `Save ${Math.round(offer.discount_percentage)}% on selected items`;
  const type = humanize(offer.offer_type);
  return type || "Limited-time offer";
}

export function offerBlurb(offer: Offer): string | null {
  const headline = offerHeadline(offer);
  const candidates = [offer.summary, offer.offer_value].map((s) => s?.trim()).filter(Boolean) as string[];
  return candidates.find((c) => !headline.startsWith(c.slice(0, 40)) && !c.startsWith(headline.replace(/…$/, ""))) ?? null;
}

export function offerDiscountBadge(offer: Offer): string | null {
  if (offer.discount_percentage != null && offer.discount_percentage >= 1) return `${Math.round(offer.discount_percentage)}% OFF`;
  if (offer.coupon_code) return "CODE";
  if (/free\s*shipping/i.test(`${offer.offer_type ?? ""} ${offer.offer_value ?? ""}`)) return "FREE SHIP";
  return null;
}

export function offerImage(offer: Offer): string | null {
  return offer.image_url ? decodeEntities(offer.image_url) : null;
}

export type ExpiryTone = "urgent" | "soon" | "calm" | "none" | "expired";

export function offerCountdown(offer: Offer): { label: string; tone: ExpiryTone } {
  const days = daysUntil(offer.expiry_date);
  if (days === null) return { label: "Ongoing offer", tone: "none" };
  if (days < 0) return { label: "Expired", tone: "expired" };
  if (days === 0) return { label: "Ends today", tone: "urgent" };
  if (days === 1) return { label: "Ends tomorrow", tone: "urgent" };
  if (days <= 7) return { label: `Ends in ${days} days`, tone: "soon" };
  return {
    label: `Ends ${new Date(offer.expiry_date!).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`,
    tone: "calm",
  };
}

/** Ranks richer offers first so home rails don't lead with bare, brandless rows. */
export function offerCompleteness(offer: Offer): number {
  return (
    (offer.brand ? 2 : 0) +
    (offer.title || offer.summary ? 2 : 0) +
    (offer.image_url ? 1 : 0) +
    (offer.expiry_date ? 1 : 0)
  );
}
