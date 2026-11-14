import type { TakhfifBusinessDetail } from "../../../types/takhfif";

/** One card = one row, flattened for the results UI and CSV export. */
export interface FlatOffer {
  business: string;
  slug: string;
  bank: string;
  card: string;
  pct: number | null;
  tier: string;
  maxDiscount?: string;
  validity?: string;
  bankOfferUrl?: string;
}

export function flattenOffers(details: Record<string, TakhfifBusinessDetail>): FlatOffer[] {
  const rows: FlatOffer[] = [];
  for (const d of Object.values(details)) {
    for (const bank of d.banks) {
      for (const tier of bank.tiers) {
        for (const card of tier.cards) {
          rows.push({
            business: d.name, slug: d.slug, bank: bank.bankName, card: card.cardName,
            pct: card.discountPercentage, tier: tier.title,
            maxDiscount: card.maxDiscountText, validity: bank.validityText,
            bankOfferUrl: bank.bankOfferUrl,
          });
        }
      }
    }
  }
  return rows;
}

function download(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

const OFFER_COLS: (keyof FlatOffer)[] = [
  "business", "slug", "bank", "card", "pct", "tier", "maxDiscount", "validity", "bankOfferUrl",
];

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportOffersCsv(offers: FlatOffer[]): void {
  const rows = [
    OFFER_COLS.join(","),
    ...offers.map((o) => OFFER_COLS.map((c) => esc(o[c])).join(",")),
  ];
  download(`takhfif-card-offers-${Date.now()}.csv`, "text/csv", rows.join("\n"));
}

function parseReviewCount(t?: string): number | null {
  const m = t?.match(/([\d.,]+)\s*([KM])?/i);
  if (!m) return null;
  const mul = /k/i.test(m[2] ?? "") ? 1_000 : /m/i.test(m[2] ?? "") ? 1_000_000 : 1;
  const n = parseFloat(m[1].replace(/,/g, "")) * mul;
  return Number.isNaN(n) ? null : Math.round(n);
}

function cityFromAddress(address: string): string {
  return address.match(/,\s*([^,-]+?)\s*-\s*Pakistan\s*$/i)?.[1]?.trim() ?? "";
}

export function toBusinessSchema(d: TakhfifBusinessDetail) {
  const hoursText = (d.openingHours ?? []).map((h) => `${h.day}: ${h.hours}`).join("; ");
  return {
    business_id: d.slug,
    name: d.name,
    description: d.description ?? "",
    category: d.category ?? "",
    rating: d.rating ?? null,
    review_count: parseReviewCount(d.reviewCountText),
    logo_url: d.logoImage ?? "",
    cover_image_url: d.coverImage ?? "",
    website: d.website ?? "",
    phone: d.phone ?? "",
    banks: d.banks.map((bank) => ({
      bank_name: bank.bankName,
      bank_logo: "",
      discount_percentage: bank.maxDiscountPercentage,
      cards: bank.tiers.flatMap((tier) =>
        tier.cards.map((card) => ({
          card_name: card.cardName,
          discount_percentage: card.discountPercentage,
          maximum_discount: card.maxDiscountText ?? "",
          valid_days: tier.title && !/%\s*off/i.test(tier.title) ? [tier.title] : [],
          terms_and_conditions: bank.terms,
        }))),
    })),
    branches: d.branches.map((b) => ({
      branch_name: b.name,
      address: b.address,
      city: cityFromAddress(b.address),
      area: "",
      latitude: b.latitude ?? null,
      longitude: b.longitude ?? null,
      phone: d.phone ?? "",
      opening_hours: hoursText,
    })),
    gallery: d.gallery.map((g) => g.url),
    menu_url: "",
    social_links: {
      facebook: d.facebookUrl ?? "",
      instagram: d.instagramUrl ?? "",
      website: d.website ?? "",
    },
    source_url: d.sourceUrl,
    last_scraped_at: d.scrapedAt,
  };
}

export function exportBusinessesJson(details: Record<string, TakhfifBusinessDetail>): void {
  download(`takhfif-businesses-${Date.now()}.json`, "application/json",
    JSON.stringify({ businesses: Object.values(details).map(toBusinessSchema) }, null, 2));
}
