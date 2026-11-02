import type { ScrapedOffer } from "../../types";
import { parsePrice, parseCurrency } from "../../utils/price";

function getMeta(name: string): string | undefined {
  const el =
    document.querySelector<HTMLMetaElement>(`meta[property="${name}"]`) ||
    document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  return el?.content || undefined;
}

export function extractFromMeta(sourceUrl: string): ScrapedOffer | null {
  const title =
    getMeta("og:title") ||
    getMeta("twitter:title") ||
    document.title ||
    "";

  const salePriceRaw =
    getMeta("product:sale_price:amount") ||
    getMeta("og:price:amount") ||
    getMeta("product:price:amount");

  const originalPriceRaw =
    getMeta("product:original_price:amount") ||
    getMeta("og:original_price:amount");

  const salePrice = parsePrice(salePriceRaw);
  const originalPrice = parsePrice(originalPriceRaw);

  if (!salePrice && !originalPrice) return null;

  const currencyRaw =
    getMeta("product:sale_price:currency") ||
    getMeta("og:price:currency") ||
    getMeta("product:price:currency");

  const image =
    getMeta("og:image") ||
    getMeta("twitter:image");

  const ogUrl = getMeta("og:url") || sourceUrl;

  const description =
    getMeta("og:description") ||
    getMeta("twitter:description");

  return {
    title,
    description,
    image_url: image,
    sale_price: salePrice,
    original_price: originalPrice,
    currency: parseCurrency(currencyRaw),
    no_expiry: true,
    offer_url: ogUrl,
    source_url: sourceUrl,
    scraped_at: new Date().toISOString(),
  };
}
