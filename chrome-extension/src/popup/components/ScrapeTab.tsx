import { useEffect, useRef, useState } from "react";
import type { ScrapedOffer, ScanStatus, ScrapeProgress, CrawlConfig, ProductScrapeConfig } from "../../types";
import { WebsiteCard } from "./WebsiteCard";
import { ScrapeProgressPanel } from "./ScrapeProgressPanel";
import { OfferList } from "./OfferList";

interface Props {
  domain: string;
  pageUrl: string;
  status: ScanStatus;
  progress: ScrapeProgress;
  offers: ScrapedOffer[];
  selected: Set<string>;
  saving: boolean;
  productConfig: ProductScrapeConfig;
  onProductConfigChange: (c: ProductScrapeConfig) => void;
  onScanPage: (config?: ProductScrapeConfig) => void;
  onCrawl: (config: CrawlConfig) => void;
  onStopScan: () => void;
  onSelectElements: () => void;
  onToggle: (key: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onChange: (key: string, updated: ScrapedOffer) => void;
  onSave: () => void;
}

const DEFAULT_CRAWL: CrawlConfig = { maxPages: 10, depth: 2, delay: 1000, maxOffers: 50 };

const CRAWL_FIELDS: [keyof CrawlConfig, string, number, number][] = [
  ["maxPages", "Max Pages", 1, 100],
  ["depth", "Depth", 1, 5],
  ["delay", "Delay (ms)", 0, 5000],
  ["maxOffers", "Max Offers", 1, 500],
];

const STORAGE_CTX_KEY = "dm_picker_context";
const STORAGE_RESULT_KEY = "dm_pending_selector";

function CountBadge({ selector, label }: { selector: string; label: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!selector) { setCount(null); return; }
    // Ask content script to count matches
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs.find((t) => t.url && !t.url.startsWith("chrome-extension://"));
      if (!tab?.id) { setCount(null); return; }
      chrome.tabs.sendMessage(tab.id, { type: "COUNT_SELECTOR", selector }, (res) => {
        if (chrome.runtime.lastError || !res) { setCount(null); return; }
        setCount(res.count ?? null);
      });
    });
  }, [selector]);

  if (count === null) return null;
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
      count > 0
        ? "bg-green-500/[0.08] text-green-400 border-green-500/20"
        : "bg-red-500/[0.08] text-red-400 border-red-500/20"
    }`}>
      {count} {label}{count !== 1 ? "s" : ""}
    </span>
  );
}

export function ScrapeTab({
  domain, pageUrl, status, progress, offers, selected, saving,
  productConfig, onProductConfigChange,
  onScanPage, onCrawl, onStopScan, onSelectElements,
  onToggle, onSelectAll, onClearAll, onChange, onSave,
}: Props) {
  const [showCrawlConfig, setShowCrawlConfig] = useState(false);
  const [crawlConfig, setCrawlConfig] = useState<CrawlConfig>(DEFAULT_CRAWL);
  const portRef = useRef<chrome.runtime.Port | null>(null);
  const [pendingField, setPendingField] = useState<"product" | "pagination" | null>(null);
  const pendingFieldRef = useRef<"product" | "pagination" | null>(null);
  const productConfigRef = useRef(productConfig);
  useEffect(() => { productConfigRef.current = productConfig; }, [productConfig]);
  const isScanning = status === "scanning";

  const hasProductConfig = !!(
    productConfig.productSelector || productConfig.paginationSelector || productConfig.autoScroll
  );

  // Connect port for live selector-picked events (popup stays open)
  useEffect(() => {
    const port = chrome.runtime.connect({ name: "popup" });
    portRef.current = port;

    port.onMessage.addListener((msg: { type: string; selector?: string }) => {
      if (msg.type === "SELECTOR_PICKED" && pendingFieldRef.current && msg.selector) {
        const field = pendingFieldRef.current;
        onProductConfigChange({
          ...productConfigRef.current,
          ...(field === "product"
            ? { productSelector: msg.selector }
            : { paginationSelector: msg.selector }),
        });
        pendingFieldRef.current = null;
        setPendingField(null);
        chrome.storage.local.remove([STORAGE_CTX_KEY, STORAGE_RESULT_KEY]);
      } else if (msg.type === "SELECTOR_MODE_CANCELLED") {
        pendingFieldRef.current = null;
        setPendingField(null);
      }
    });

    return () => port.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startPick = (field: "product" | "pagination") => {
    pendingFieldRef.current = field;
    setPendingField(field);
    chrome.storage.local.set({ [STORAGE_CTX_KEY]: field });
    chrome.runtime.sendMessage({ type: "START_SELECTOR_MODE" });
    // Do NOT close popup — overlay tells user to click on page
  };

  const cancelPick = () => {
    chrome.runtime.sendMessage({ type: "STOP_SELECTOR_MODE" });
    chrome.storage.local.remove([STORAGE_CTX_KEY]);
    pendingFieldRef.current = null;
    setPendingField(null);
  };

  const actionBtn = "flex flex-col items-center gap-1.5 p-3 rounded-xl transition disabled:opacity-40 text-center";

  const inputCls = "flex-1 min-w-0 text-[10px] px-2 py-1.5 border border-line rounded-lg outline-none focus:border-primary bg-surface-2 text-t1 placeholder-t3 font-mono";

  return (
    <div className="flex flex-col h-full">
      {/* Picker active banner */}
      {pendingField && (
        <div className="mx-3 mt-2 flex items-center gap-2 px-3 py-2 bg-primary/10 border border-primary/30 rounded-xl flex-shrink-0">
          <span className="relative flex-shrink-0 w-2 h-2">
            <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
            <span className="relative block w-2 h-2 rounded-full bg-primary" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[9px] font-black text-primary uppercase tracking-wide">Picker Active</p>
            <p className="text-[9px] text-t2">
              Click {pendingField === "product" ? "a product card" : "the next-page button"} on page
            </p>
          </div>
          <button
            onClick={cancelPick}
            className="flex-shrink-0 px-2 py-1 bg-surface-2 border border-line rounded-lg text-[9px] font-bold text-t2 hover:text-red-400 hover:border-red-500/30 transition"
          >
            Stop
          </button>
        </div>
      )}
      <div className="scrollable">
        <WebsiteCard
          domain={domain}
          pageUrl={pageUrl}
          status={status}
          offersCount={offers.length}
          onRefresh={() => onScanPage(productConfig)}
        />

        {isScanning ? (
          <ScrapeProgressPanel progress={progress} onStop={onStopScan} />
        ) : (
          <div className="mx-3 mt-2 flex flex-col gap-2">
            {/* 3 action buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onScanPage(productConfig)}
                disabled={!domain}
                className={`${actionBtn} ${hasProductConfig ? "bg-primary hover:bg-primary-dark text-white" : "bg-primary hover:bg-primary-dark text-white"}`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                </svg>
                <span className="text-[10px] font-bold leading-tight">Scan Page</span>
              </button>

              <button
                onClick={() => setShowCrawlConfig((v) => !v)}
                disabled={!domain}
                className={`${actionBtn} ${
                  showCrawlConfig
                    ? "bg-surface-3 text-t1"
                    : "bg-surface border border-line text-t1 hover:border-primary hover:text-primary"
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                <span className="text-[10px] font-bold leading-tight">Crawl Site</span>
              </button>

              <button
                onClick={onSelectElements}
                disabled={!domain}
                className={`${actionBtn} bg-surface border border-line text-t1 hover:border-primary hover:text-primary`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <circle cx="12" cy="12" r="3"/>
                  <line x1="12" y1="2" x2="12" y2="5"/>
                  <line x1="12" y1="19" x2="12" y2="22"/>
                  <line x1="2" y1="12" x2="5" y2="12"/>
                  <line x1="19" y1="12" x2="22" y2="12"/>
                </svg>
                <span className="text-[10px] font-bold leading-tight">Selectors</span>
              </button>
            </div>

            {/* Product & Pagination selector panel — always visible */}
            <div className="bg-surface border border-line rounded-xl overflow-hidden">
              {/* Header */}
              <div className="px-3 py-2 border-b border-line flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-t2">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                  </svg>
                  <p className="text-[8.5px] font-black text-t2 uppercase tracking-[0.1em]">Product Selector</p>
                  {hasProductConfig && (
                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-500/[0.12] text-blue-400 border border-blue-500/20">Active</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* Auto-scroll compact toggle */}
                  <span className="text-[9px] text-t3">Scroll</span>
                  <button
                    onClick={() => onProductConfigChange({ ...productConfig, autoScroll: !productConfig.autoScroll })}
                    aria-label="Toggle auto-scroll"
                    className={`relative flex-shrink-0 w-7 h-4 rounded-full transition-colors ${
                      productConfig.autoScroll ? "bg-primary" : "bg-surface-3"
                    }`}
                  >
                    <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${
                      productConfig.autoScroll ? "translate-x-3" : "translate-x-0.5"
                    }`} />
                  </button>
                  {hasProductConfig && (
                    <button
                      onClick={() => onProductConfigChange({})}
                      className="text-[9px] text-red-400 hover:text-red-300 font-bold"
                      title="Clear all selectors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <div className="p-2.5 flex flex-col gap-2">
                {/* Row 1: Product Cards */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-t3">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                    <span className="text-[9px] font-bold text-t2 uppercase tracking-wide">Product Cards</span>
                    {productConfig.productSelector && (
                      <CountBadge selector={productConfig.productSelector} label="card" />
                    )}
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={productConfig.productSelector ?? ""}
                      onChange={(e) => onProductConfigChange({ ...productConfig, productSelector: e.target.value || undefined })}
                      placeholder=".product-card, div.item…"
                      className={inputCls}
                    />
                    <button
                      onClick={() => startPick("product")}
                      title="Pick product card element on page"
                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 bg-primary/10 border border-primary/30 hover:bg-primary/20 text-primary rounded-lg transition text-[9px] font-black uppercase tracking-wide"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                        <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
                        <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
                      </svg>
                      Pick
                    </button>
                    {productConfig.productSelector && (
                      <button
                        onClick={() => onProductConfigChange({ ...productConfig, productSelector: undefined })}
                        aria-label="Clear product selector"
                        className="flex-shrink-0 w-6 flex items-center justify-center text-t3 hover:text-red-400 transition"
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Row 2: Pagination */}
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-t3">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                    <span className="text-[9px] font-bold text-t2 uppercase tracking-wide">Pagination Button</span>
                    {productConfig.paginationSelector && (
                      <CountBadge selector={productConfig.paginationSelector} label="btn" />
                    )}
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={productConfig.paginationSelector ?? ""}
                      onChange={(e) => onProductConfigChange({ ...productConfig, paginationSelector: e.target.value || undefined })}
                      placeholder=".next-page, a[rel=next]…"
                      className={inputCls}
                    />
                    <button
                      onClick={() => startPick("pagination")}
                      title="Pick next-page button on page"
                      className="flex-shrink-0 flex items-center gap-1 px-2 py-1.5 bg-primary/10 border border-primary/30 hover:bg-primary/20 text-primary rounded-lg transition text-[9px] font-black uppercase tracking-wide"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
                        <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
                        <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
                      </svg>
                      Pick
                    </button>
                    {productConfig.paginationSelector && (
                      <button
                        onClick={() => onProductConfigChange({ ...productConfig, paginationSelector: undefined })}
                        aria-label="Clear pagination selector"
                        className="flex-shrink-0 w-6 flex items-center justify-center text-t3 hover:text-red-400 transition"
                      >
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Max pages row (only when pagination set) */}
                {productConfig.paginationSelector && (
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[9px] font-bold text-t2 uppercase tracking-wide">Max Pages</span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={productConfig.maxPages ?? 3}
                      onChange={(e) => onProductConfigChange({ ...productConfig, maxPages: Math.min(10, Math.max(1, +e.target.value)) })}
                      className="w-14 text-xs px-2 py-1 border border-line rounded-lg bg-surface-2 text-t1 outline-none focus:border-primary"
                    />
                    <span className="text-[9px] text-t3">~2.5s/page</span>
                  </div>
                )}
              </div>
            </div>

            {/* Crawl config panel */}
            {showCrawlConfig && (
              <div className="bg-surface rounded-xl border border-line p-3">
                <p className="text-[8.5px] font-black text-t2 uppercase tracking-[0.1em] mb-2.5">Crawl Configuration</p>
                <div className="grid grid-cols-2 gap-2">
                  {CRAWL_FIELDS.map(([key, label, min, max]) => (
                    <div key={key}>
                      <label className="block text-[10px] text-t2 mb-0.5">{label}</label>
                      <input
                        type="number"
                        min={min}
                        max={max}
                        value={crawlConfig[key]}
                        onChange={(e) =>
                          setCrawlConfig((c) => ({ ...c, [key]: +e.target.value }))
                        }
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-line bg-surface-2 text-t1 focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { onCrawl(crawlConfig); setShowCrawlConfig(false); }}
                  disabled={!domain}
                  className="mt-2.5 w-full py-2 bg-surface-3 hover:opacity-80 disabled:opacity-40 text-t1 text-xs font-bold rounded-xl transition"
                >
                  Start Crawl
                </button>
              </div>
            )}
          </div>
        )}

        {/* Offers list */}
        {!isScanning && offers.length > 0 && (
          <div className="mt-2">
            <OfferList
              offers={offers}
              selected={selected}
              onToggle={onToggle}
              onSelectAll={onSelectAll}
              onClearAll={onClearAll}
              onChange={onChange}
            />
          </div>
        )}

        {/* Empty states */}
        {!isScanning && offers.length === 0 && status === "done" && (
          <div className="flex flex-col items-center py-10 px-4 text-center">
            <span className="text-3xl mb-2">🔍</span>
            <p className="text-xs font-semibold text-t2">No offers found</p>
            <p className="text-[10px] text-t2 mt-1">Try a deals or sale page, or use the Crawl option.</p>
          </div>
        )}

        {!isScanning && status === "idle" && (
          <div className="flex flex-col items-center py-10 px-4 text-center">
            <span className="text-3xl mb-2">🛍</span>
            <p className="text-xs font-semibold text-t2">Ready to scrape</p>
            <p className="text-[10px] text-t2 mt-1">Open a deals page and tap Scan Page.</p>
          </div>
        )}

        {!isScanning && status === "error" && offers.length === 0 && (
          <div className="flex flex-col items-center py-10 px-4 text-center">
            <span className="text-3xl mb-2">⚠️</span>
            <p className="text-xs font-semibold text-t2">Scan failed</p>
            <p className="text-[10px] text-t2 mt-1">Reload the page and try again.</p>
          </div>
        )}

        <div className="h-3" />
      </div>

      {/* Docked save bar */}
      {selected.size > 0 && !isScanning && (
        <div className="px-3 py-2 border-t border-line bg-surface flex-shrink-0">
          <button
            onClick={onSave}
            disabled={saving}
            className="w-full py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white text-xs font-bold rounded-xl transition"
          >
            {saving
              ? "Saving…"
              : `Save ${selected.size} offer${selected.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
