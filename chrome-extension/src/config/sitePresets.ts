import type { ListingConfig } from "../types";

type Preset = Pick<ListingConfig, "containerSelector" | "fields" | "pagination">;

/** Built-in listing-config presets for specific sites, keyed by hostname
 * (no "www."). Auto-applied in SelectorsTab when the admin opens a
 * matching domain and hasn't picked anything yet — saves re-picking a
 * well-known site's selectors by hand every time. Still fully editable
 * afterward, same as a manually-picked config.
 *
 * takhfif.app/deals: verified against the live DOM (Nov 2026) — the card
 * is `<a href="/place/{slug}">`, so the container uses the href-prefix
 * selector the picker now generates by default (see content/css-gen.ts)
 * rather than its long, non-semantic Tailwind class chain. Note this only
 * covers the /deals LIST page (place name, discount %, bank/card counts);
 * takhfif.app itself is already fully scraped server-side via its JSON-LD
 * (services/takhfif_scraper.py on scraper_server) — this preset exists for
 * quick inspection/demo of the extension's picker, not production use. */
export const SITE_PRESETS: Record<string, Preset> = {
  "takhfif.app": {
    containerSelector: 'a[href^="/place/"]',
    fields: {
      title: { css: "p.line-clamp-1", attr: "text" },
      url: { css: ":scope", attr: "href" },
      image: { css: 'img[data-nimg="fill"]', attr: "src" },
      discount: { css: "p.text-xl.font-bold", attr: "text" },
      availability: { css: "div.mt-auto span", attr: "text" },   // card-offer count, e.g. "67 card offers"
      sku: { css: "span.backdrop-blur-md", attr: "text" },        // bank count, e.g. "10 banks"
    },
    pagination: {
      method: "url-pattern",
      urlPattern: "https://takhfif.app/deals?page={page}",
      urlStartPage: 1,
      urlEndPage: 101,
      maxPages: 101,
      pageLoadDelay: 1500,
    },
  },
};

export function getSitePreset(hostname: string): ListingConfig | null {
  const preset = SITE_PRESETS[hostname.replace(/^www\./, "")];
  if (!preset) return null;
  return {
    containerSelector: preset.containerSelector,
    fields: { ...preset.fields },
    pagination: { ...preset.pagination },
  };
}
