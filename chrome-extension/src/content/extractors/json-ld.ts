import type { ScrapedOffer } from "../../types";
import { parsePrice, parseCurrency, calcDiscount } from "../../utils/price";

interface JsonLdOffer {
  "@type"?: string;
  price?: string | number;
  priceCurrency?: string;
  priceValidUntil?: string;
  availability?: string;
  url?: string;
}

interface JsonLdProduct {
  "@type"?: string;
  name?: string;
  description?: string;
  brand?: { name?: string } | string;
  image?: string | string[];
  offers?: JsonLdOffer | JsonLdOffer[];
  category?: string;
  url?: string;
}

function extractBrandName(brand: JsonLdProduct["brand"]): string | undefined {
  if (!brand) return undefined;
  if (typeof brand === "string") return brand;
  return brand.name;
}

function extractImage(image: JsonLdProduct["image"]): string | undefined {
  if (!image) return undefined;
  if (typeof image === "string") return image;
  return image[0];
}

export function extractFromJsonLd(sourceUrl: string): ScrapedOffer[] {
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  );
  const results: ScrapedOffer[] = [];

  scripts.forEach((script) => {
    let data: unknown;
    try {
      data = JSON.parse(script.textContent || "{}");
    } catch {
      return;
    }

    const items: JsonLdProduct[] = [];
    if (Array.isArray(data)) {
      items.push(...(data as JsonLdProduct[]));
    } else {
      items.push(data as JsonLdProduct);
    }

    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const type = (item["@type"] as string) || "";
      if (!["Product", "ItemPage", "Offer"].includes(type)) continue;

      const offersRaw = (item as JsonLdProduct).offers;
      const offerList: JsonLdOffer[] = offersRaw
        ? Array.isArray(offersRaw) ? offersRaw : [offersRaw]
        : [{}];

      for (const rawOffer of offerList) {
        const salePrice = parsePrice(String(rawOffer.price ?? ""));
        const currency = parseCurrency(String(rawOffer.priceCurrency ?? ""));
        const offerUrl = (rawOffer.url || item.url || sourceUrl).toString();

        const offer: ScrapedOffer = {
          title: (item.name as string) || document.title || "",
          description: (item.description as string) || undefined,
          brand: extractBrandName((item as JsonLdProduct).brand),
          image_url: extractImage((item as JsonLdProduct).image),
          category: (item.category as string) || undefined,
          sale_price: salePrice,
          currency,
          expiry_date: (rawOffer.priceValidUntil as string) || undefined,
          no_expiry: !rawOffer.priceValidUntil,
          offer_url: offerUrl,
          source_url: sourceUrl,
          scraped_at: new Date().toISOString(),
        };

        if (salePrice) results.push(offer);
      }
    }
  });

  return results;
}

export function extractOfferJsonLd(sourceUrl: string): ScrapedOffer[] {
  const scripts = document.querySelectorAll<HTMLScriptElement>(
    'script[type="application/ld+json"]',
  );
  const results: ScrapedOffer[] = [];

  scripts.forEach((script) => {
    let data: unknown;
    try { data = JSON.parse(script.textContent || "{}"); } catch { return; }

    const flat: unknown[] = Array.isArray(data) ? data : [data];
    for (const item of flat) {
      if (!item || typeof item !== "object") continue;
      const t = (item as Record<string, unknown>)["@type"];
      if (t !== "Offer") continue;

      const rawOffer = item as JsonLdOffer;
      const salePrice = parsePrice(String(rawOffer.price ?? ""));
      if (!salePrice) continue;

      results.push({
        title: document.title || "Offer",
        sale_price: salePrice,
        currency: parseCurrency(rawOffer.priceCurrency?.toString()),
        expiry_date: rawOffer.priceValidUntil?.toString(),
        no_expiry: !rawOffer.priceValidUntil,
        offer_url: rawOffer.url?.toString() || sourceUrl,
        source_url: sourceUrl,
        scraped_at: new Date().toISOString(),
      });
    }
  });

  return results;
}

export { calcDiscount };
