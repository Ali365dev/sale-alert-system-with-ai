import type { ScrapedOffer } from "../types";

function makeKey(offer: ScrapedOffer): string {
  // Normalise URL — strip query params for dedup purposes
  try {
    const u = new URL(offer.offer_url);
    return `${u.origin}${u.pathname}`.toLowerCase();
  } catch {
    return offer.offer_url.toLowerCase();
  }
}

export function deduplicateOffers(offers: ScrapedOffer[]): ScrapedOffer[] {
  const seen = new Map<string, ScrapedOffer>();
  for (const o of offers) {
    const key = makeKey(o);
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, { ...o, _key: key });
    } else {
      // Prefer the richer record
      const score = (x: ScrapedOffer) =>
        (x.discount_percentage ? 2 : 0) +
        (x.image_url ? 1 : 0) +
        (x.coupon_code ? 2 : 0) +
        (x.original_price ? 1 : 0);
      if (score(o) > score(existing)) seen.set(key, { ...o, _key: key });
    }
  }
  return Array.from(seen.values());
}
