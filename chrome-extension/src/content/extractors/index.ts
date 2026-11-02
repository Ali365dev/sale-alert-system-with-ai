import type { ScrapedOffer } from "../../types";
import { extractFromJsonLd, extractOfferJsonLd } from "./json-ld";
import { extractFromMeta } from "./meta";
import { extractFromDom } from "./dom";
import { deduplicateOffers } from "../../utils/dedupe";

export function extractAllOffers(sourceUrl: string): ScrapedOffer[] {
  const all: ScrapedOffer[] = [];

  // Stage 1 — JSON-LD Product schema
  all.push(...extractFromJsonLd(sourceUrl));
  all.push(...extractOfferJsonLd(sourceUrl));

  // Stage 2 — Open Graph / product meta tags
  const metaOffer = extractFromMeta(sourceUrl);
  if (metaOffer) all.push(metaOffer);

  // Stage 3 — DOM pattern scanning
  all.push(...extractFromDom(sourceUrl));

  // Filter out offers with no meaningful content
  const meaningful = all.filter(
    (o) =>
      o.title.trim().length > 2 &&
      (o.discount_percentage || o.sale_price || o.coupon_code || o.original_price),
  );

  return deduplicateOffers(meaningful);
}
