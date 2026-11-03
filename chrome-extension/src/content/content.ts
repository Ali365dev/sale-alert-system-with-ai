import type { ScrapeResponse } from "../types";
import { extractAllOffers, extractOverviewOffers } from "./extractors";
import { startSelectorMode, stopSelectorMode } from "./selector-mode";

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
