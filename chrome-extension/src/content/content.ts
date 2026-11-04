import type { ScrapeResponse, ProductScrapeConfig, ListingConfig, ExtractedProduct } from "../types";
import { extractAllOffers, extractOverviewOffers, extractProductOffers } from "./extractors";
import { deduplicateOffers } from "../utils/dedupe";
import { startSelectorMode, stopSelectorMode } from "./selector-mode";

function extractAttr(el: Element, attr?: string): string {
  if (!attr || attr === "text") return (el.textContent ?? "").trim();
  if (attr === "src") {
    return (el as HTMLImageElement).src
      || el.getAttribute("data-src")
      || el.getAttribute("data-original")
      || el.getAttribute("srcset")?.split(" ")[0]
      || "";
  }
  if (attr === "href") return (el as HTMLAnchorElement).href || el.getAttribute("href") || "";
  return el.getAttribute(attr) ?? "";
}

function resolveUrl(val: string, base: string): string {
  if (!val) return "";
  try { return new URL(val, base).href; } catch { return val; }
}

function extractListingProducts(config: ListingConfig, pageUrl: string): ExtractedProduct[] {
  const containers = Array.from(document.querySelectorAll(config.containerSelector));
  return containers.map((container) => {
    const get = (field?: { css: string; attr?: string }) => {
      if (!field?.css) return undefined;
      try {
        const el = container.querySelector(field.css);
        if (!el) return undefined;
        const val = extractAttr(el, field.attr);
        if (field.attr === "href" || field.attr === "src")
          return resolveUrl(val, pageUrl);
        return val || undefined;
      } catch { return undefined; }
    };
    const f = config.fields;
    return {
      title: get(f.title),
      url: get(f.url) ? resolveUrl(get(f.url)!, pageUrl) : undefined,
      image: get(f.image),
      currentPrice: get(f.currentPrice),
      originalPrice: get(f.originalPrice),
      discount: get(f.discount),
      availability: get(f.availability),
      sku: get(f.sku),
    } as ExtractedProduct;
  }).filter((p) => p.title || p.url || p.currentPrice);
}

/** Scroll down in steps to trigger lazy-loaded content, then scroll back up. */
async function autoScroll(maxDistance = 12000, stepDelay = 300): Promise<void> {
  return new Promise((resolve) => {
    const step = 600;
    let scrolled = 0;
    const tick = () => {
      window.scrollBy(0, step);
      scrolled += step;
      const atBottom = window.scrollY + window.innerHeight >= document.body.scrollHeight - 100;
      if (scrolled >= maxDistance || atBottom) {
        setTimeout(resolve, 800);
      } else {
        setTimeout(tick, stepDelay);
      }
    };
    tick();
  });
}

chrome.runtime.onMessage.addListener(
  (message: { type: string } & Record<string, unknown>, _sender, sendResponse) => {
    if (message.type === "SCRAPE_PAGE" || message.type === "SCRAPE_PAGE_OVERVIEW") {
      try {
        const offers = message.type === "SCRAPE_PAGE_OVERVIEW"
          ? extractOverviewOffers(window.location.href)
          : extractAllOffers(window.location.href);
        const response: ScrapeResponse = { type: "SCRAPE_RESULT", offers };
        sendResponse(response);
      } catch (err) {
        const response: ScrapeResponse = {
          type: "SCRAPE_RESULT",
          offers: [],
          error: err instanceof Error ? err.message : "Extraction failed",
        };
        sendResponse(response);
      }
      return true;
    }

    if (message.type === "SCRAPE_PAGE_PRODUCT") {
      const config = (message.config ?? {}) as ProductScrapeConfig;
      const maxPages = Math.min(Math.max(config.maxPages ?? 1, 1), 10);

      (async () => {
        const allOffers: ReturnType<typeof extractAllOffers> = [];
        const url = () => window.location.href;

        for (let page = 0; page < maxPages; page++) {
          if (config.autoScroll) await autoScroll();

          allOffers.push(...extractProductOffers(url(), config));

          if (config.paginationSelector && page < maxPages - 1) {
            let nextBtn: HTMLElement | null = null;
            try { nextBtn = document.querySelector<HTMLElement>(config.paginationSelector); } catch {}
            if (!nextBtn) break;
            nextBtn.click();
            await new Promise<void>((res) => setTimeout(res, 2500));
          } else {
            break;
          }
        }

        const response: ScrapeResponse = {
          type: "SCRAPE_RESULT",
          offers: deduplicateOffers(allOffers),
        };
        sendResponse(response);
      })();
      return true;
    }

    if (message.type === "EXTRACT_LISTING") {
      try {
        const config = message.config as ListingConfig;
        const products = extractListingProducts(config, window.location.href);
        sendResponse({ products, count: products.length });
      } catch (err) {
        sendResponse({ products: [], count: 0, error: err instanceof Error ? err.message : "Failed" });
      }
      return true;
    }

    if (message.type === "COUNT_SELECTOR") {
      try {
        const count = document.querySelectorAll(message.selector as string).length;
        sendResponse({ count });
      } catch {
        sendResponse({ count: 0 });
      }
      return true;
    }

    if (message.type === "START_SELECTOR_MODE") {
      startSelectorMode();
      sendResponse({ type: "SELECTOR_MODE_STARTED" });
      return true;
    }

    if (message.type === "STOP_SELECTOR_MODE") {
      stopSelectorMode();
      sendResponse({ type: "SELECTOR_MODE_STOPPED" });
      return true;
    }

    return false;
  },
);
