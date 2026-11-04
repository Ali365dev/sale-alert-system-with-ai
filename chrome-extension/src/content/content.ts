import type { ScrapeResponse, ProductScrapeConfig } from "../types";
import { extractAllOffers, extractOverviewOffers, extractProductOffers } from "./extractors";
import { deduplicateOffers } from "../utils/dedupe";
import { startSelectorMode, stopSelectorMode } from "./selector-mode";

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
