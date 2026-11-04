import type { ScrapedOffer, ProductScrapeConfig } from "../../types";
import { extractFromJsonLd, extractOfferJsonLd } from "./json-ld";
import { extractFromMeta } from "./meta";
import { extractFromDom, extractBannerAndCouponOffers, extractWithProductSelector } from "./dom";
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

/** Overview mode: extract only sitewide banners and coupon codes — no per-product JSON-LD. */
export function extractOverviewOffers(sourceUrl: string): ScrapedOffer[] {
  const all = extractBannerAndCouponOffers(sourceUrl);
  const meaningful = all.filter(
    (o) => o.title.trim().length > 2 && (o.discount_percentage || o.coupon_code),
  );
  return deduplicateOffers(meaningful);
}

/** Product mode: uses custom product selector and falls back to full extraction. */
export function extractProductOffers(sourceUrl: string, config: ProductScrapeConfig): ScrapedOffer[] {
  const all: ScrapedOffer[] = [];

  if (config.productSelector) {
    all.push(...extractWithProductSelector(sourceUrl, config.productSelector));
    // Still include banners/coupons from the page
    all.push(...extractBannerAndCouponOffers(sourceUrl));
  } else {
    all.push(...extractFromJsonLd(sourceUrl));
    all.push(...extractOfferJsonLd(sourceUrl));
    const meta = extractFromMeta(sourceUrl);
    if (meta) all.push(meta);
    all.push(...extractFromDom(sourceUrl));
  }

  const meaningful = all.filter(
    (o) => o.title.trim().length > 2 &&
      (o.discount_percentage || o.sale_price || o.coupon_code || o.original_price),
  );
  return deduplicateOffers(meaningful);
}
