import { useState } from "react";
import type { ScrapedOffer, ScanStatus, ScrapeProgress, CrawlConfig } from "../../types";
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
  onScanPage: () => void;
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

export function ScrapeTab({
  domain, pageUrl, status, progress, offers, selected, saving,
  onScanPage, onCrawl, onStopScan, onSelectElements,
  onToggle, onSelectAll, onClearAll, onChange, onSave,
}: Props) {
  const [showCrawlConfig, setShowCrawlConfig] = useState(false);
  const [crawlConfig, setCrawlConfig] = useState<CrawlConfig>(DEFAULT_CRAWL);
  const isScanning = status === "scanning";

  const actionBtn = "flex flex-col items-center gap-1.5 p-3 rounded-xl transition disabled:opacity-40 text-center";

  return (
    <div className="flex flex-col h-full">
      <div className="scrollable">
        <WebsiteCard
          domain={domain}
          pageUrl={pageUrl}
          status={status}
          offersCount={offers.length}
          onRefresh={onScanPage}
        />

        {isScanning ? (
          <ScrapeProgressPanel progress={progress} onStop={onStopScan} />
        ) : (
          <div className="mx-3 mt-2 flex flex-col gap-2">
            {/* 3 action buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={onScanPage}
                disabled={!domain}
                className={`${actionBtn} bg-primary hover:bg-primary-dark text-white`}
              >
                <span className="text-xl">⚡</span>
                <span className="text-[10px] font-bold leading-tight">Scan Page</span>
              </button>

              <button
                onClick={() => setShowCrawlConfig((v) => !v)}
                disabled={!domain}
                className={`${actionBtn} ${
                  showCrawlConfig
                    ? "bg-dark text-white"
                    : "bg-white border border-gray-200 text-dark hover:border-primary hover:text-primary"
                }`}
              >
                <span className="text-xl">🕷</span>
                <span className="text-[10px] font-bold leading-tight">Crawl Site</span>
              </button>

              <button
                onClick={onSelectElements}
                disabled={!domain}
                className={`${actionBtn} bg-white border border-gray-200 text-dark hover:border-primary hover:text-primary`}
              >
                <span className="text-xl">🎯</span>
                <span className="text-[10px] font-bold leading-tight">Select</span>
              </button>
            </div>

            {/* Crawl config panel */}
            {showCrawlConfig && (
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-xs font-bold text-dark mb-2">Crawl Configuration</p>
                <div className="grid grid-cols-2 gap-2">
                  {CRAWL_FIELDS.map(([key, label, min, max]) => (
                    <div key={key}>
                      <label className="block text-[10px] text-gray-500 mb-0.5">{label}</label>
                      <input
                        type="number"
                        min={min}
                        max={max}
                        value={crawlConfig[key]}
                        onChange={(e) =>
                          setCrawlConfig((c) => ({ ...c, [key]: +e.target.value }))
                        }
                        className="w-full px-2 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-primary/30 bg-gray-50"
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => { onCrawl(crawlConfig); setShowCrawlConfig(false); }}
                  disabled={!domain}
                  className="mt-2.5 w-full py-2 bg-dark hover:bg-gray-800 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition"
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
            <p className="text-xs font-semibold text-gray-500">No offers found</p>
            <p className="text-[10px] text-gray-400 mt-1">Try a deals or sale page, or use the Crawl option.</p>
          </div>
        )}

        {!isScanning && status === "idle" && (
          <div className="flex flex-col items-center py-10 px-4 text-center">
            <span className="text-3xl mb-2">🛍</span>
            <p className="text-xs font-semibold text-gray-500">Ready to scrape</p>
            <p className="text-[10px] text-gray-400 mt-1">Open a deals page and tap Scan Page.</p>
          </div>
        )}

        {!isScanning && status === "error" && offers.length === 0 && (
          <div className="flex flex-col items-center py-10 px-4 text-center">
            <span className="text-3xl mb-2">⚠️</span>
            <p className="text-xs font-semibold text-gray-500">Scan failed</p>
            <p className="text-[10px] text-gray-400 mt-1">Reload the page and try again.</p>
          </div>
        )}

        <div className="h-3" />
      </div>

      {/* Docked save bar */}
      {selected.size > 0 && !isScanning && (
        <div className="px-3 py-2 border-t border-gray-200 bg-white flex-shrink-0">
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
