import type { ExtensionMessage, ScrapeMessage } from "../types";

chrome.runtime.onInstalled.addListener(() => {
  console.log("Deals More Scraper installed.");
});

// ── Tab-based browser scraping ────────────────────────────────────────────────

const TAB_SCRAPE_KEY = "dm_tab_scrape";
let tabScrapeCancelled = false;

interface TabScrapeEntry { id: number; name: string; website: string; }

function patchTabScrapeState(patch: Record<string, unknown>) {
  chrome.storage.local.get(TAB_SCRAPE_KEY, (r) => {
    const merged = { ...(r[TAB_SCRAPE_KEY] as Record<string, unknown> ?? {}), ...patch };
    chrome.storage.local.set({ [TAB_SCRAPE_KEY]: merged });
    // Forward to popup if connected
    if (popupPort) {
      try { popupPort.postMessage({ type: "TAB_SCRAPE_UPDATE", state: merged }); } catch {}
    }
  });
}

function waitForTabComplete(tabId: number, timeoutMs = 25000): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, timeoutMs);
    function listener(id: number, info: chrome.tabs.TabChangeInfo) {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        clearTimeout(timer);
        setTimeout(resolve, 800); // let JS finish rendering
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function scrapeTabUrl(tabId: number, url: string): Promise<unknown[]> {
  let response = await sendToTab(tabId, { type: "SCRAPE_PAGE", url });
  if (response === null) {
    await new Promise<void>((res) => {
      chrome.scripting.executeScript(
        { target: { tabId }, files: ["content.js"] },
        () => setTimeout(res, 500),
      );
    });
    response = await sendToTab(tabId, { type: "SCRAPE_PAGE", url });
  }
  return (response as { offers?: unknown[] } | null)?.offers ?? [];
}

async function scrapeViaTabsLoop(brands: TabScrapeEntry[]) {
  tabScrapeCancelled = false;
  const allOffers: unknown[] = [];

  patchTabScrapeState({
    active: true, cancelled: false, doneCount: 0,
    totalCount: brands.length, offersFound: 0,
    currentBrand: "", currentUrl: "", offers: [],
  });

  for (let i = 0; i < brands.length; i++) {
    if (tabScrapeCancelled) break;

    const brand = brands[i];
    const url = brand.website.startsWith("http") ? brand.website : `https://${brand.website}`;

    patchTabScrapeState({ currentBrand: brand.name, currentUrl: url, doneCount: i });

    let tabId: number | null = null;
    try {
      const tab = await new Promise<chrome.tabs.Tab>((resolve) => {
        chrome.tabs.create({ url, active: false }, resolve);
      });
      tabId = tab.id ?? null;
      if (tabId == null) continue;

      await waitForTabComplete(tabId);
      if (tabScrapeCancelled) break;

      const offers = await scrapeTabUrl(tabId, url);
      allOffers.push(...offers);
      patchTabScrapeState({ offersFound: allOffers.length, doneCount: i + 1, offers: allOffers });
    } catch {
      // skip and continue
    } finally {
      if (tabId != null) chrome.tabs.remove(tabId).catch(() => {});
    }

    // Small delay between brands to avoid hammering
    if (i < brands.length - 1 && !tabScrapeCancelled) {
      await new Promise((res) => setTimeout(res, 600));
    }
  }

  patchTabScrapeState({
    active: false, doneCount: brands.length,
    currentBrand: "", currentUrl: "", offers: allOffers,
  });
}

// Track which popup port is open so content-script messages can be forwarded
let popupPort: chrome.runtime.Port | null = null;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    popupPort = port;
    port.onDisconnect.addListener(() => { popupPort = null; });
  }
});

function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  return new Promise((resolve) => {
    // lastFocusedWindow: true finds the active tab across all windows, not just
    // the popup window (which would be "currentWindow" after the popup opens).
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      // Skip the popup window itself — it has no URL the scraper cares about
      const tab = tabs.find((t) => t.url && !t.url.startsWith("chrome-extension://"));
      resolve(tab ?? null);
    });
  });
}

function sendToTab(tabId: number, message: object): Promise<unknown> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) resolve(null);
      else resolve(response);
    });
  });
}

// Relay messages between popup and content script
chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage & Record<string, unknown>, _sender, sendResponse) => {
    // ── Messages from content script → forward to popup ───────────────────
    if (
      message.type === "SELECTOR_PICKED" ||
      message.type === "SELECTOR_MODE_CANCELLED"
    ) {
      if (popupPort) {
        try { popupPort.postMessage(message); } catch { /* popup closed */ }
      }
      sendResponse({ ok: true });
      return true;
    }

    // ── Messages from popup → forward to content script ───────────────────
    if (
      message.type === "SCRAPE_PAGE" ||
      message.type === "START_SELECTOR_MODE" ||
      message.type === "STOP_SELECTOR_MODE"
    ) {
      const scrapeMsg = message as ScrapeMessage;

      getActiveTab().then(async (tab) => {
        if (!tab?.id) {
          if (message.type === "SCRAPE_PAGE") {
            sendResponse({ type: "SCRAPE_RESULT", offers: [], error: "No active tab" });
          } else {
            sendResponse({ ok: false, error: "No active tab" });
          }
          return;
        }

        let response = await sendToTab(tab.id, scrapeMsg);

        if (response === null) {
          // Content script not injected — inject then retry
          await new Promise<void>((res) => {
            chrome.scripting.executeScript(
              { target: { tabId: tab.id! }, files: ["content.js"] },
              () => setTimeout(res, 300),
            );
          });
          response = await sendToTab(tab.id, scrapeMsg);
        }

        if (message.type === "SCRAPE_PAGE") {
          sendResponse(response ?? { type: "SCRAPE_RESULT", offers: [], error: "Injection failed" });
        } else {
          sendResponse(response ?? { ok: false });
        }
      });

      return true;
    }

    // ── Tab-based browser scraping messages ───────────────────────────────
    if (message.type === "SCRAPE_BRANDS_VIA_TABS") {
      const brands = (message as Record<string, unknown>).brands as TabScrapeEntry[];
      if (Array.isArray(brands) && brands.length > 0) {
        scrapeViaTabsLoop(brands);
      }
      sendResponse({ ok: true });
      return true;
    }

    if (message.type === "CANCEL_TAB_SCRAPE") {
      tabScrapeCancelled = true;
      sendResponse({ ok: true });
      return true;
    }

    return false;
  },
);
