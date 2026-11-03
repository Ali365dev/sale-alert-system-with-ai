import type { ScrapedOffer } from "../../types";
import { parsePrice, parseCurrency, parseDiscountPercent, calcDiscount } from "../../utils/price";

const PROMO_KEYWORDS = /\b(sale|off|discount|clearance|promo|coupon|deal|save|special offer|flash sale|limited time|upto|up to|flat)\b/i;
const COUPON_PATTERN = /\b([A-Z0-9]{4,20})\b/;

// Broad sale-price selectors covering Shopify themes (Dawn, Debut, Prestige, Impulse), WooCommerce, and custom stores
const PRICE_ELEMENT_SELECTORS = [
  // Generic patterns
  "[class*='sale-price']", "[class*='saleprice']", "[class*='special-price']",
  "[class*='discounted']", "[class*='offer-price']", "[class*='promo-price']",
  "[class*='reduced-price']", "[class*='now-price']", "[class*='current-price']",
  "[class*='new-price']", "[class*='final-price']", "[class*='selling-price']",
  // Data attributes
  "[data-sale-price]", "[data-discount-price]", "[data-final-price]",
  // Shopify Dawn / Debut / Prestige themes
  ".price--sale", ".price-sale", ".price--discounted",
  ".price__sale", ".price-item--sale", ".price__current",
  "[class*='price'][class*='sale']", "[class*='price'][class*='reduced']",
  // WooCommerce
  ".woocommerce-Price-amount", "ins .amount",
  // Other common patterns
  ".offer .price", ".product-price .sale", "[class*='after-price']",
];

const ORIGINAL_PRICE_SELECTORS = [
  "[class*='original-price']", "[class*='regular-price']", "[class*='was-price']",
  "[class*='old-price']", "[class*='compare-price']", "[data-compare-price]",
  "[class*='list-price']", "[class*='msrp']", "[class*='rrp']",
  "s.price", "del.price", ".price--compare", ".price-compare",
  ".price__compare", ".price-item--regular", "[class*='strike']",
  // WooCommerce del
  "del .amount", "del .woocommerce-Price-amount",
];

const COUPON_SELECTORS = [
  "[class*='coupon']", "[class*='promo-code']", "[class*='discount-code']",
  "[data-coupon]", "[data-promo-code]", ".coupon-code", ".promo-code",
  "[class*='voucher']", "[class*='gift-code']",
];

const BANNER_SELECTORS = [
  "[class*='banner']", "[class*='announcement']", "[class*='promotional']",
  "[class*='offer-strip']", "[id*='promo']", "[id*='sale']",
  "[class*='marquee']", "[class*='ticker']", "[class*='top-bar']",
  "[class*='header-bar']", "[class*='promo-bar']", "[class*='sale-bar']",
  "[id*='announcement']", "[id*='banner']",
  "header", ".hero", ".site-header",
];

// Product container selectors for grouping price + title + image
const PRODUCT_CONTAINER_SELECTORS = [
  "article", "li",
  "[class*='product']", "[class*='card']", "[class*='item']",
  "[class*='tile']", "[class*='grid-item']", "[class*='collection-item']",
];

function getText(el: Element): string {
  return (el.textContent || "").trim();
}

function getLink(el: Element): string {
  const a = el.closest("a") || el.querySelector("a");
  if (a) return (a as HTMLAnchorElement).href;
  return window.location.href;
}

function getImage(container: Element): string | undefined {
  const img = container.querySelector<HTMLImageElement>("img[src], img[data-src], img[data-lazy-src]");
  if (!img) return undefined;
  return img.src || img.dataset.src || img.dataset.lazySrc || img.dataset.srcset?.split(" ")[0];
}

function getContainer(el: Element): Element {
  return el.closest(PRODUCT_CONTAINER_SELECTORS.join(",")) || el.parentElement || el;
}

function getTitle(container: Element): string {
  const titleEl = container.querySelector("h1,h2,h3,h4,[class*='title'],[class*='name'],[class*='product-name']");
  return (titleEl ? getText(titleEl) : getText(container)).slice(0, 200) || document.title;
}

/** Find discounted price pairs in the DOM (sale price + original price near each other) */
function extractPricePairs(sourceUrl: string): ScrapedOffer[] {
  const results: ScrapedOffer[] = [];

  const salePriceEls = document.querySelectorAll(PRICE_ELEMENT_SELECTORS.join(","));
  salePriceEls.forEach((el) => {
    const salePriceText = getText(el);
    const salePrice = parsePrice(salePriceText);
    if (!salePrice) return;

    const container = getContainer(el);

    let originalPrice: number | undefined;
    let origText = "";
    for (const sel of ORIGINAL_PRICE_SELECTORS) {
      const origEl = container.querySelector(sel);
      if (origEl) {
        origText = getText(origEl);
        originalPrice = parsePrice(origText);
        if (originalPrice) break;
      }
    }

    const title = getTitle(container);

    results.push({
      title,
      sale_price: salePrice,
      original_price: originalPrice && originalPrice > salePrice ? originalPrice : undefined,
      discount_percentage: originalPrice && originalPrice > salePrice ? calcDiscount(originalPrice, salePrice) : undefined,
      currency: parseCurrency(salePriceText) || parseCurrency(origText),
      image_url: getImage(container),
      offer_url: getLink(container),
      source_url: sourceUrl,
      no_expiry: true,
      scraped_at: new Date().toISOString(),
    });
  });

  return results;
}

/**
 * Scan for <s>/<del> strikethrough elements (original prices) paired with a lower current price.
 * This is the most reliable universal heuristic for fashion/e-commerce sites that use custom class names.
 */
function extractStrikethroughPairs(sourceUrl: string): ScrapedOffer[] {
  const results: ScrapedOffer[] = [];
  const seen = new Set<string>();

  document.querySelectorAll("s, del").forEach((el) => {
    const origText = getText(el);
    const originalPrice = parsePrice(origText);
    if (!originalPrice || originalPrice < 1) return;

    const container = getContainer(el);
    const containerKey = container.className + container.tagName;
    if (seen.has(containerKey)) return;

    // Find a price lower than original in the same container
    let salePrice: number | undefined;
    let salePriceText = "";

    const childEls = container.querySelectorAll("span, div, p, strong, bdi");
    for (const child of childEls) {
      if (child === el || el.contains(child) || child.contains(el)) continue;
      // Skip if child contains another strikethrough (avoid nested)
      if (child.querySelector("s, del")) continue;
      const text = getText(child);
      if (!text) continue;
      const p = parsePrice(text);
      if (p && p > 0 && p < originalPrice) {
        salePrice = p;
        salePriceText = text;
        break;
      }
    }

    if (!salePrice) return;
    seen.add(containerKey);

    results.push({
      title: getTitle(container),
      sale_price: salePrice,
      original_price: originalPrice,
      discount_percentage: calcDiscount(originalPrice, salePrice),
      currency: parseCurrency(salePriceText) || parseCurrency(origText),
      image_url: getImage(container),
      offer_url: getLink(container),
      source_url: sourceUrl,
      no_expiry: true,
      scraped_at: new Date().toISOString(),
    });
  });

  return results;
}

/** Scan discount badge/pill elements (e.g. "-30%", "SALE 20% OFF") near product containers */
function extractDiscountBadges(sourceUrl: string): ScrapedOffer[] {
  const results: ScrapedOffer[] = [];
  const BADGE_SELECTORS = [
    "[class*='badge']", "[class*='label']", "[class*='tag']", "[class*='sticker']",
    "[class*='discount']", "[class*='saving']", "[class*='percent']",
  ].join(",");

  document.querySelectorAll(BADGE_SELECTORS).forEach((el) => {
    const text = getText(el);
    const discount = parseDiscountPercent(text);
    if (!discount) return;

    const container = getContainer(el);

    // Need at least a price to be meaningful
    let salePrice: number | undefined;
    let salePriceText = "";
    for (const sel of PRICE_ELEMENT_SELECTORS) {
      const priceEl = container.querySelector(sel);
      if (priceEl) {
        salePriceText = getText(priceEl);
        salePrice = parsePrice(salePriceText);
        if (salePrice) break;
      }
    }
    // Fallback: any numeric-looking span
    if (!salePrice) {
      container.querySelectorAll("span, div").forEach((child) => {
        if (salePrice) return;
        const t = getText(child);
        const p = parsePrice(t);
        if (p && p > 0) { salePrice = p; salePriceText = t; }
      });
    }

    results.push({
      title: getTitle(container),
      discount_percentage: discount,
      sale_price: salePrice,
      currency: salePrice ? parseCurrency(salePriceText) : undefined,
      image_url: getImage(container),
      offer_url: getLink(container),
      source_url: sourceUrl,
      no_expiry: true,
      scraped_at: new Date().toISOString(),
    });
  });

  return results;
}

/** Scan banners and announcement bars for promo text and coupon codes */
function extractBannerOffers(sourceUrl: string): ScrapedOffer[] {
  const results: ScrapedOffer[] = [];

  document.querySelectorAll(BANNER_SELECTORS.join(",")).forEach((el) => {
    const text = getText(el);
    if (!PROMO_KEYWORDS.test(text)) return;

    const discount = parseDiscountPercent(text);
    const couponMatch = text.match(/(?:code|coupon|promo)[:\s]+([A-Z0-9]{4,20})/i);
    const couponCode = couponMatch ? couponMatch[1] : undefined;

    if (!discount && !couponCode) return;

    results.push({
      title: text.slice(0, 200),
      discount_percentage: discount,
      coupon_code: couponCode,
      no_expiry: true,
      offer_url: sourceUrl,
      source_url: sourceUrl,
      scraped_at: new Date().toISOString(),
    });
  });

  return results;
}

/** Extract standalone coupon code elements */
function extractCouponCodes(sourceUrl: string): ScrapedOffer[] {
  const results: ScrapedOffer[] = [];

  document.querySelectorAll(COUPON_SELECTORS.join(",")).forEach((el) => {
    const text = getText(el);
    const match = text.match(COUPON_PATTERN);
    if (!match) return;

    results.push({
      title: `Coupon: ${match[1]}`,
      coupon_code: match[1],
      no_expiry: true,
      offer_url: sourceUrl,
      source_url: sourceUrl,
      scraped_at: new Date().toISOString(),
    });
  });

  return results;
}

export function extractBannerAndCouponOffers(sourceUrl: string): ScrapedOffer[] {
  return [
    ...extractBannerOffers(sourceUrl),
    ...extractCouponCodes(sourceUrl),
  ];
}

export function extractFromDom(sourceUrl: string): ScrapedOffer[] {
  return [
    ...extractPricePairs(sourceUrl),
    ...extractStrikethroughPairs(sourceUrl),
    ...extractDiscountBadges(sourceUrl),
    ...extractBannerOffers(sourceUrl),
    ...extractCouponCodes(sourceUrl),
  ];
}

export { parseDiscountPercent, PROMO_KEYWORDS };
