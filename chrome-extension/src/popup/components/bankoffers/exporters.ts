import type { TakhfifListing } from "../../../types/takhfif";

function download(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function exportListingsJson(listings: TakhfifListing[]): void {
  download(`takhfif-listings-${Date.now()}.json`, "application/json", JSON.stringify(listings, null, 2));
}

const CSV_COLS: (keyof TakhfifListing)[] = [
  "business_name", "detail_url", "category", "location", "rating",
  "discount_text", "discount_percentage", "bank_count", "card_offer_count",
  "review_count_text", "expiry_text", "cover_image", "logo_url",
  "listing_page", "source_url", "scraped_at",
];

export function exportListingsCsv(listings: TakhfifListing[]): void {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [
    CSV_COLS.join(","),
    ...listings.map((l) => CSV_COLS.map((c) => esc(l[c])).join(",")),
  ];
  download(`takhfif-listings-${Date.now()}.csv`, "text/csv", rows.join("\n"));
}
