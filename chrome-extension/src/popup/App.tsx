import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ScrapedOffer, ScanStatus, TabId, CrawlConfig,
  ScrapeProgress, ConnectionStatus,
} from "../types";
import { isAuthenticated, clearSession, addHistoryEntry } from "../services/storage";
import { checkSession, saveOffers, triggerServerScrape } from "../services/api";
import { LoginScreen } from "./components/LoginScreen";
import { Header } from "./components/Header";
import { BottomNav } from "./components/BottomNav";
import { BrandsTab } from "./components/BrandsTab";
import { SelectorsTab } from "./components/SelectorsTab";
import { HistoryTab } from "./components/HistoryTab";
import { SettingsTab } from "./components/SettingsTab";
import { Toast } from "./components/Toast";
import type { ToastMessage, ToastType } from "./components/Toast";

let toastCounter = 0;

const IDLE_PROGRESS: ScrapeProgress = {
  operation: "Ready",
  percent: 0,
  pagesVisited: 0,
  offersDetected: 0,
  offersProcessed: 0,
  offersSaved: 0,
};

export function App() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [tab, setTab] = useState<TabId>("brands");
  const [pageUrl, setPageUrl] = useState("");
  const [connStatus, setConnStatus] = useState<ConnectionStatus>({
    appServer: "unknown",
    scraperServer: "unknown",
  });

  // Scan-page state (passed into BrandsTab → ScrapeTab)
  const [scanStatus, setScanStatus] = useState<ScanStatus>("idle");
  const [scanProgress, setScanProgress] = useState<ScrapeProgress>(IDLE_PROGRESS);
  const [scanOffers, setScanOffers] = useState<ScrapedOffer[]>([]);
  const [scanSelected, setScanSelected] = useState<Set<string>>(new Set());
  const [scanSaving, setScanSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Set to true when the user stops a scan so the stale sendMessage callback is ignored.
  const scanCancelledRef = useRef(false);

  // Auth check on mount
  useEffect(() => {
    const timeout = setTimeout(() => setAuthed(false), 10_000);
    (async () => {
      try {
        const stored = await isAuthenticated();
        if (!stored) { setAuthed(false); return; }
        const live = await checkSession().catch(() => false);
        if (!live) { await clearSession(); setAuthed(false); return; }
        setAuthed(true);
      } finally {
        clearTimeout(timeout);
      }
    })();
    return () => clearTimeout(timeout);
  }, []);

  // Read active tab URL after auth
  useEffect(() => {
    if (!authed) return;
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      setPageUrl(tabs[0]?.url ?? "");
    });
  }, [authed]);

  // Toast helpers
  const addToast = useCallback((type: ToastType, text: string) => {
    const id = ++toastCounter;
    setToasts((ts) => [...ts, { id, type, text }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const stopScan = useCallback(() => {
    scanCancelledRef.current = true;
    if (progressRef.current) clearInterval(progressRef.current);
    setScanStatus("idle");
    setScanProgress(IDLE_PROGRESS);
    setScanOffers([]);
  }, []);

  const domain = pageUrl
    ? (() => { try { return new URL(pageUrl).hostname; } catch { return ""; } })()
    : "";

  const runScan = useCallback(() => {
    scanCancelledRef.current = false;
    setScanStatus("scanning");
    setScanOffers([]);
    setScanSelected(new Set());
    setScanProgress({ ...IDLE_PROGRESS, operation: "Scanning page…", percent: 10 });

    let pct = 10;
    progressRef.current = setInterval(() => {
      pct = Math.min(pct + 8, 85);
      setScanProgress((p) => ({ ...p, percent: pct }));
    }, 250);

    chrome.runtime.sendMessage({ type: "SCRAPE_PAGE", url: pageUrl }, (response) => {
      if (progressRef.current) clearInterval(progressRef.current);
      if (scanCancelledRef.current) return;
      if (chrome.runtime.lastError || !response || response.error) {
        setScanStatus("error");
        setScanProgress(IDLE_PROGRESS);
        addToast("error", response?.error ?? "Scan failed. Reload the page and try again.");
        return;
      }
      const extracted: ScrapedOffer[] = response.offers ?? [];
      setScanOffers(extracted);
      setScanStatus("done");
      setScanProgress((p) => ({ ...p, percent: 100, offersDetected: extracted.length }));
      addHistoryEntry({
        id: Date.now().toString(), url: pageUrl, domain,
        mode: "scan", offersFound: extracted.length, offersSaved: 0,
        startedAt: new Date().toISOString(), status: "done",
      }).catch(() => {});
      if (extracted.length === 0) {
        addToast("info", "No promotional offers detected on this page.");
      } else {
        addToast("success", `${extracted.length} offer${extracted.length !== 1 ? "s" : ""} detected.`);
        setScanSelected(new Set(extracted.map((o) => o._key ?? o.offer_url)));
      }
    });
  }, [pageUrl, domain, addToast]);

  const runCrawl = useCallback(async (_config: CrawlConfig) => {
    if (!pageUrl) return;
    setScanStatus("scanning");
    setScanOffers([]);
    setScanSelected(new Set());
    setScanProgress({ ...IDLE_PROGRESS, operation: "Queuing crawl…", percent: 20 });
    try {
      const result = await triggerServerScrape(pageUrl);
      addToast("success", `Crawl queued (job #${result.jobId}). Check History for results.`);
      addHistoryEntry({
        id: Date.now().toString(), url: pageUrl, domain, mode: "crawl",
        offersFound: 0, offersSaved: 0, startedAt: new Date().toISOString(), status: "done",
      }).catch(() => {});
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Crawl failed");
    } finally {
      setScanStatus("idle");
      setScanProgress(IDLE_PROGRESS);
    }
  }, [pageUrl, domain, addToast]);

  const handleSave = useCallback(async () => {
    const toSave = scanOffers.filter((o) => scanSelected.has(o._key ?? o.offer_url));
    if (!toSave.length) return;
    setScanSaving(true);
    try {
      const results = await saveOffers(toSave);
      addToast("success", `${results.length} offer${results.length !== 1 ? "s" : ""} saved.`);
      setScanSelected(new Set());
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Save failed");
    } finally {
      setScanSaving(false);
    }
  }, [scanOffers, scanSelected, addToast]);

  if (authed === null) {
    return (
      <div className="flex items-center justify-center h-full bg-white">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return <LoginScreen onLogin={() => setAuthed(true)} />;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <Header onSettingsClick={() => setTab("settings")} connStatus={connStatus} />
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <div className="flex-1 flex flex-col min-h-0">
        {tab === "brands" && (
          <BrandsTab
            pageUrl={pageUrl}
            scanStatus={scanStatus}
            scanProgress={scanProgress}
            scanOffers={scanOffers}
            scanSelected={scanSelected}
            scanSaving={scanSaving}
            onScanPage={runScan}
            onCrawl={runCrawl}
            onStopScan={stopScan}
            onSelectElements={() => setTab("selectors")}
            onToggleOffer={(key) => setScanSelected((s) => {
              const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n;
            })}
            onSelectAll={() => setScanSelected(new Set(scanOffers.map((o) => o._key ?? o.offer_url)))}
            onClearAll={() => setScanSelected(new Set())}
            onOfferChange={(key, updated) => setScanOffers((p) => p.map((o) => (o._key ?? o.offer_url) === key ? updated : o))}
            onSave={handleSave}
            onToast={addToast}
            onViewHistory={() => setTab("history")}
          />
        )}
        {tab === "selectors" && <SelectorsTab pageUrl={pageUrl} />}
        {tab === "history" && <HistoryTab />}
        {tab === "settings" && (
          <SettingsTab onLogout={() => setAuthed(false)} onConnStatusChange={setConnStatus} />
        )}
      </div>

      <BottomNav activeTab={tab} onTabChange={setTab} />
    </div>
  );
}
