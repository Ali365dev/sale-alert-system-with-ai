import { useCallback, useEffect, useRef, useState } from "react";
import type { TabScrapeState, Brand, ScrapedOffer } from "../../types";
import { saveOffers } from "../../services/api";

const STORAGE_KEY = "dm_tab_scrape";
const POLL_MS = 1000;

const DEFAULT_STATE: TabScrapeState = {
  active: false,
  cancelled: false,
  currentBrand: "",
  currentUrl: "",
  doneCount: 0,
  totalCount: 0,
  offersFound: 0,
  offers: [],
};

export function useTabScrape(onToast: (type: "success" | "error" | "info", text: string) => void) {
  const [state, setState] = useState<TabScrapeState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const readState = useCallback((): Promise<TabScrapeState> =>
    new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (r) => {
        resolve({ ...DEFAULT_STATE, ...(r[STORAGE_KEY] as Partial<TabScrapeState> ?? {}) });
      });
    }),
  []);

  // Start polling when active
  useEffect(() => {
    const startPoll = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        const s = await readState();
        setState(s);
        if (!s.active) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
        }
      }, POLL_MS);
    };

    // On mount, check if a scrape is already running
    readState().then((s) => {
      setState(s);
      if (s.active) startPoll();
    });

    // Listen for real-time updates from service worker
    const listener = (msg: { type?: string; state?: TabScrapeState }) => {
      if (msg.type === "TAB_SCRAPE_UPDATE" && msg.state) {
        setState(msg.state);
        if (msg.state.active) startPoll();
        else { clearInterval(pollRef.current!); pollRef.current = null; }
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      chrome.runtime.onMessage.removeListener(listener);
    };
  }, [readState]);

  const startBrowserScrape = useCallback((brands: Brand[]) => {
    const payload = brands.map((b) => ({
      id: b.id,
      name: b.name,
      website: b.website ?? "",
    }));
    chrome.runtime.sendMessage({ type: "SCRAPE_BRANDS_VIA_TABS", brands: payload });
    // Optimistically set active state
    setState({ ...DEFAULT_STATE, active: true, totalCount: brands.length });
  }, []);

  const cancelBrowserScrape = useCallback(() => {
    chrome.storage.local.set({ [STORAGE_KEY]: { ...DEFAULT_STATE, cancelled: true, active: false } });
    chrome.runtime.sendMessage({ type: "CANCEL_TAB_SCRAPE" });
    setState(DEFAULT_STATE);
  }, []);

  const updateOfferList = useCallback((offers: ScrapedOffer[]) => {
    setState((s) => ({ ...s, offers }));
    chrome.storage.local.get(STORAGE_KEY, (r) => {
      const merged = { ...(r[STORAGE_KEY] as Record<string, unknown> ?? {}), offers };
      chrome.storage.local.set({ [STORAGE_KEY]: merged });
    });
  }, []);

  const updateOffer = useCallback((index: number, updated: ScrapedOffer) => {
    const next = [...state.offers];
    next[index] = updated;
    updateOfferList(next);
  }, [state.offers, updateOfferList]);

  const removeOffer = useCallback((index: number) => {
    const next = state.offers.filter((_, i) => i !== index);
    updateOfferList(next);
  }, [state.offers, updateOfferList]);

  const saveCollectedOffers = useCallback(async (offers?: ScrapedOffer[]) => {
    const toSave = offers ?? state.offers;
    if (!toSave.length) return;
    setSaving(true);
    try {
      const results = await saveOffers(toSave);
      onToast("success", `${results.length} offer${results.length !== 1 ? "s" : ""} saved.`);
      chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_STATE });
      setState(DEFAULT_STATE);
    } catch (err) {
      onToast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [state.offers, onToast]);

  const dismissCollected = useCallback(() => {
    chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_STATE });
    setState(DEFAULT_STATE);
  }, []);

  return { state, saving, startBrowserScrape, cancelBrowserScrape, saveCollectedOffers, updateOffer, removeOffer, dismissCollected };
}
