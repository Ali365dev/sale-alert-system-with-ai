import { useCallback, useEffect, useRef, useState } from "react";
import type { Brand, BrandSubTab, Job, ProductScrapeConfig } from "../../types";
import { listBrands, triggerBrandScrape, triggerMultiBrandScrape } from "../../services/brandsApi";
import { getJob, storeActiveJobId, clearActiveJobId, loadActiveJobId, isJobTerminal, cancelJob } from "../../services/jobsApi";
import { BrandCard } from "./BrandCard";
import { Tooltip } from "./Tooltip";
import { DiscoverTab } from "./DiscoverTab";
import { JobStatusPanel } from "./JobStatusPanel";
import { OfferCard } from "./OfferCard";
import { ScrapeTab } from "./ScrapeTab";
import { TabScrapePanel } from "./TabScrapePanel";
import { useTabScrape } from "../hooks/useTabScrape";
import type { ScanStatus, ScrapeProgress, ScrapedOffer, CrawlConfig } from "../../types";

interface Props {
  pageUrl: string;
  // ScrapeTab passthrough props
  scanStatus: ScanStatus;
  scanProgress: ScrapeProgress;
  scanOffers: ScrapedOffer[];
  scanSelected: Set<string>;
  scanSaving: boolean;
  productConfig: ProductScrapeConfig;
  onProductConfigChange: (c: ProductScrapeConfig) => void;
  onScanPage: (config?: ProductScrapeConfig) => void;
  onCrawl: (c: CrawlConfig) => void;
  onStopScan: () => void;
  onSelectElements: () => void;
  onToggleOffer: (key: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onOfferChange: (key: string, o: ScrapedOffer) => void;
  onSave: () => void;
  onToast: (type: "success" | "error" | "info", text: string) => void;
  onViewHistory: () => void;
}

const POLL_MS = 4000;

export function BrandsTab({
  pageUrl, scanStatus, scanProgress, scanOffers, scanSelected, scanSaving,
  productConfig, onProductConfigChange,
  onScanPage, onCrawl, onStopScan, onSelectElements,
  onToggleOffer, onSelectAll, onClearAll, onOfferChange, onSave, onToast, onViewHistory,
}: Props) {
  const [subTab, setSubTab] = useState<BrandSubTab>("list");
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [overviewMode, setOverviewMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { state: tabState, saving: tabSaving, startBrowserScrape, cancelBrowserScrape, saveCollectedOffers, updateOffer, removeOffer, dismissCollected } = useTabScrape(onToast);
  const [reviewSelected, setReviewSelected] = useState<Set<number>>(new Set());

  // Auto-select all offers when they first arrive
  useEffect(() => {
    if (!tabState.active && tabState.offers.length > 0) {
      setReviewSelected(new Set(tabState.offers.map((_, i) => i)));
    }
  }, [tabState.active, tabState.offers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBrands = useCallback(async () => {
    try {
      const data = await listBrands();
      setBrands(data);
    } catch {
      onToast("error", "Failed to load brands.");
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  // Poll active job
  const startPolling = useCallback((jobId: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      const job = await getJob(jobId);
      if (!job) return;
      setActiveJob(job);
      if (isJobTerminal(job.status)) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        clearActiveJobId();
        if (job.status === "done") {
          onToast("success", `Scrape complete. ${job.successful ?? 0} offers saved.`);
          fetchBrands();
        } else if (job.status === "failed") {
          onToast("error", `Scrape failed: ${job.error ?? "unknown error"}`);
        }
        setTimeout(() => setActiveJob(null), 3000);
      }
    }, POLL_MS);
  }, [onToast, fetchBrands]);

  useEffect(() => {
    fetchBrands();
    // Resume polling if a job was active before popup closed
    loadActiveJobId().then((id) => {
      if (id != null) {
        getJob(id).then((job) => {
          if (!job) return;
          if (!isJobTerminal(job.status)) {
            setActiveJob(job);
            startPolling(id);
          } else {
            clearActiveJobId();
          }
        });
      }
    });
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchBrands, startPolling]);

  const handleScrape = useCallback(async (brandId: number) => {
    try {
      const result = await triggerBrandScrape(brandId);
      storeActiveJobId(result.jobId);
      const job = await getJob(result.jobId);
      if (job) setActiveJob(job);
      startPolling(result.jobId);
      onToast("info", `Scrape started (job #${result.jobId})`);
    } catch (err) {
      onToast("error", err instanceof Error ? err.message : "Scrape trigger failed");
    }
  }, [startPolling, onToast]);

  const handleScrapeSelected = useCallback(async () => {
    if (!selected.size) return;
    const ids = Array.from(selected);
    const jobIds = await triggerMultiBrandScrape(ids);
    if (jobIds.length) {
      const lastJobId = jobIds[jobIds.length - 1];
      storeActiveJobId(lastJobId);
      const job = await getJob(lastJobId);
      if (job) setActiveJob(job);
      startPolling(lastJobId);
      onToast("info", `${jobIds.length} scrape job${jobIds.length !== 1 ? "s" : ""} started.`);
      setSelected(new Set());
    }
  }, [selected, startPolling, onToast]);

  const handleScrapeAll = useCallback(async () => {
    const ids = filtered.filter((b) => b.website_scraping_enabled).map((b) => b.id);
    if (!ids.length) return;
    const jobIds = await triggerMultiBrandScrape(ids);
    if (jobIds.length) {
      const lastJobId = jobIds[jobIds.length - 1];
      storeActiveJobId(lastJobId);
      const job = await getJob(lastJobId);
      if (job) setActiveJob(job);
      startPolling(lastJobId);
      onToast("info", `${jobIds.length} scrape jobs queued.`);
    }
  }, [startPolling, onToast]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancelJob = useCallback(async () => {
    if (!activeJob) return;
    await cancelJob(activeJob.id).catch(() => {});
    onToast("info", "Cancel requested.");
  }, [activeJob, onToast]);

  const toggleBrand = useCallback((id: number) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  // Derived filtered list
  const countries = Array.from(new Set(brands.map((b) => b.country).filter(Boolean) as string[])).sort();
  const filtered = brands.filter((b) => {
    const q = search.toLowerCase();
    if (q && !b.name.toLowerCase().includes(q) && !(b.website ?? "").toLowerCase().includes(q)) return false;
    if (countryFilter && b.country !== countryFilter) return false;
    return true;
  });
  const allSelected = filtered.length > 0 && filtered.every((b) => selected.has(b.id));

  const domain = pageUrl ? (() => { try { return new URL(pageUrl).hostname.replace("www.", ""); } catch { return ""; } })() : "";

  const isAnyScrapeActive = tabState.active || (activeJob != null && (activeJob.status === "pending" || activeJob.status === "running"));

  const SUB_TABS: { id: BrandSubTab; label: string }[] = [
    { id: "list", label: "Brands" },
    { id: "discover", label: "Discover" },
    { id: "scan", label: "Scan Page" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Sub-nav */}
      <div className="flex border-b border-line bg-surface flex-shrink-0 h-9">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id)}
            className={`flex-1 h-full text-[8.5px] font-bold uppercase tracking-[0.07em] transition relative ${
              subTab === t.id ? "text-primary" : "text-t2 hover:text-t1"
            }`}
          >
            {subTab === t.id && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-t-full" />
            )}
            {t.label}
          </button>
        ))}
        {/* Global stop button */}
        {isAnyScrapeActive && (
          <Tooltip text={tabState.active ? "Cancel browser scrape" : `Cancel job #${activeJob?.id}`} position="bottom">
            <button
              onClick={() => {
                if (tabState.active) cancelBrowserScrape();
                else if (activeJob) handleCancelJob();
              }}
              className="px-3 h-full text-[8.5px] font-bold text-red-500 hover:text-red-400 flex items-center gap-1 flex-shrink-0 bg-red-500/[0.07] border-l border-red-500/[0.18]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
              Stop
            </button>
          </Tooltip>
        )}
      </div>

      {/* Sub-tab content */}
      {subTab === "list" && (
        <div className="flex flex-col flex-1 min-h-0">
          {/* Search + filter bar */}
          <div className="flex gap-2 px-3 py-2 flex-shrink-0">
            <input
              type="text"
              placeholder="Search brands…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-xs px-2.5 py-1.5 border border-line rounded-lg outline-none focus:border-primary bg-surface-2 text-t1 placeholder-t3"
            />
            {countries.length > 0 && (
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="text-xs px-2 py-1.5 border border-line rounded-lg outline-none focus:border-primary bg-surface-2 text-t1"
                aria-label="Filter by country"
              >
                <option value="">All</option>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            )}
          </div>

          {/* Action bar */}
          <div className="flex items-center gap-2 px-3 pb-2 flex-shrink-0">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => {
                if (allSelected) setSelected(new Set());
                else setSelected(new Set(filtered.map((b) => b.id)));
              }}
              aria-label="Select all brands"
              className="w-3.5 h-3.5 accent-primary cursor-pointer"
            />
            <span className="text-[10px] text-t2 flex-1">
              {selected.size > 0 ? `${selected.size} selected` : `${filtered.length} brands`}
            </span>
            {selected.size > 0 && (
              <button
                onClick={handleScrapeSelected}
                className="px-2.5 py-1 text-[10px] font-bold bg-primary text-white rounded-lg hover:bg-primary-dark transition"
              >
                Scrape {selected.size}
              </button>
            )}
            <button
              onClick={handleScrapeAll}
              className="px-2.5 py-1 text-[10px] font-bold bg-surface-3 text-t1 rounded-lg hover:opacity-80 transition"
            >
              All
            </button>
            <Tooltip text={overviewMode ? "Overview mode: sitewide deals & coupons" : "Products mode: individual product offers"}>
              <button
                onClick={() => setOverviewMode((v) => !v)}
                className={`px-2 py-1 text-[10px] font-bold rounded-lg transition border ${
                  overviewMode
                    ? "bg-purple-900/30 text-purple-400 border-purple-500/30"
                    : "bg-surface-3 text-t2 border-line"
                }`}
              >
                {overviewMode ? "OVR" : "PRD"}
              </button>
            </Tooltip>
            <Tooltip text={tabState.active ? "Scrape in progress…" : "Open brand websites in tabs and scrape"}>
              <button
                onClick={() => {
                  const targets = selected.size > 0
                    ? filtered.filter((b) => selected.has(b.id) && b.website)
                    : filtered.filter((b) => b.website);
                  if (targets.length) startBrowserScrape(targets, overviewMode);
                }}
                disabled={tabState.active}
                aria-label="Scrape via browser tabs"
                className="px-2.5 py-1 text-[10px] font-bold bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </button>
            </Tooltip>
            <Tooltip text="Refresh brands">
              <button onClick={fetchBrands} aria-label="Refresh brands" className="text-t2 hover:text-t1 text-sm">
                ↻
              </button>
            </Tooltip>
          </div>

          {/* Batch scrape panel — shown when list is idle */}
          {!loading && filtered.length > 0 && !activeJob && !tabState.active && tabState.offers.length === 0 && (
            <div className="mx-3 mb-1 mt-1 bg-surface border border-line rounded-xl p-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-2.5">
                <div>
                  <p className="text-[9px] font-black text-t1 uppercase tracking-[0.08em]">Batch Scrape All</p>
                  <p className="text-[9px] text-t2 mt-0.5">Queue all scrape-enabled brands</p>
                </div>
                <button
                  onClick={handleScrapeAll}
                  className="px-3 py-1.5 bg-primary hover:bg-primary-dark text-white text-[9px] font-black rounded-lg transition"
                >
                  Scrape All {filtered.filter((b) => b.website_scraping_enabled).length}
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 text-center bg-surface-2 rounded-lg py-1.5">
                  <p className="text-[13px] font-black text-t1">{filtered.length}</p>
                  <p className="text-[8px] text-t2 uppercase tracking-wide">Brands</p>
                </div>
                <div className="flex-1 text-center bg-surface-2 rounded-lg py-1.5">
                  <p className="text-[13px] font-black text-t1">{filtered.filter((b) => b.website_scraping_enabled).length}</p>
                  <p className="text-[8px] text-t2 uppercase tracking-wide">Enabled</p>
                </div>
                <div className="flex-1 text-center bg-surface-2 rounded-lg py-1.5">
                  <p className="text-[13px] font-black text-t1">~{Math.max(1, Math.ceil(filtered.filter((b) => b.website_scraping_enabled).length * 0.5))}m</p>
                  <p className="text-[8px] text-t2 uppercase tracking-wide">Est.</p>
                </div>
              </div>
            </div>
          )}

          {/* Active backend job panel */}
          {activeJob && (
            <div className="flex-shrink-0">
              <JobStatusPanel job={activeJob} onCancel={handleCancelJob} onViewHistory={onViewHistory} />
            </div>
          )}

          {/* Browser tab scraping panel */}
          {tabState.active && (
            <div className="flex-shrink-0">
              <TabScrapePanel state={tabState} onCancel={cancelBrowserScrape} />
            </div>
          )}

          {/* Collected offers review panel — replaces brand list */}
          {!tabState.active && tabState.offers.length > 0 && (
            <div className="flex flex-col flex-1 min-h-0">
              {/* Review header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-line flex-shrink-0">
                <span className="text-[10px] font-bold text-green-400 flex-1">
                  🌐 {tabState.offers.length} offers collected
                </span>
                <label className="flex items-center gap-1 text-[10px] text-t2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reviewSelected.size === tabState.offers.length && tabState.offers.length > 0}
                    onChange={() => {
                      if (reviewSelected.size === tabState.offers.length) setReviewSelected(new Set());
                      else setReviewSelected(new Set(tabState.offers.map((_, i) => i)));
                    }}
                    className="w-3 h-3 accent-primary"
                  />
                  All
                </label>
                <Tooltip text={`Save ${reviewSelected.size} selected offer${reviewSelected.size !== 1 ? "s" : ""} to server`}>
                  <button
                    onClick={() => saveCollectedOffers(tabState.offers.filter((_, i) => reviewSelected.has(i)))}
                    disabled={tabSaving || reviewSelected.size === 0}
                    className="px-2.5 py-1 text-[10px] font-bold bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:opacity-40"
                  >
                    {tabSaving ? "Saving…" : `Save ${reviewSelected.size}`}
                  </button>
                </Tooltip>
                <Tooltip text="Discard all collected offers">
                  <button
                    onClick={dismissCollected}
                    aria-label="Discard collected offers"
                    className="text-t2 hover:text-red-400 transition text-sm font-bold"
                  >
                    ✕
                  </button>
                </Tooltip>
              </div>

              {/* Offer list */}
              <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2">
                {tabState.offers.map((offer, i) => (
                  <div key={offer._key ?? i} className="relative">
                    <OfferCard
                      offer={offer}
                      selected={reviewSelected.has(i)}
                      onToggle={() => setReviewSelected((s) => {
                        const n = new Set(s);
                        n.has(i) ? n.delete(i) : n.add(i);
                        return n;
                      })}
                      onChange={(updated) => updateOffer(i, updated)}
                    />
                    <Tooltip text="Remove this offer" position="left">
                      <button
                        onClick={() => {
                          removeOffer(i);
                          setReviewSelected((s) => {
                            const n = new Set<number>();
                            s.forEach((idx) => { if (idx < i) n.add(idx); else if (idx > i) n.add(idx - 1); });
                            return n;
                          });
                        }}
                        aria-label="Remove offer"
                        className="absolute top-2 right-8 text-[10px] text-red-400/60 hover:text-red-400 transition font-bold"
                      >
                        ✕
                      </button>
                    </Tooltip>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section label */}
          {!tabState.active && tabState.offers.length === 0 && (
            <div className="flex items-center justify-between px-3 pt-1.5 pb-1 flex-shrink-0">
              <span className="text-[8.5px] font-black text-t2 uppercase tracking-[0.1em]">Tracked Brands</span>
              {!loading && (
                <span className="text-[9px] font-bold bg-surface-2 text-t2 px-1.5 py-0.5 rounded-md">{filtered.length}</span>
              )}
            </div>
          )}

          {/* Brand list — hidden while reviewing collected offers */}
          <div className={`flex-1 overflow-y-auto ${!tabState.active && tabState.offers.length > 0 ? "hidden" : ""}`}>
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center px-4">
                <span className="text-2xl mb-2">🏪</span>
                <p className="text-xs font-semibold text-t2">No brands found</p>
                <p className="text-[10px] text-t2 mt-1">
                  {search ? "Try a different search." : "Add brands in the Discover tab."}
                </p>
              </div>
            ) : (
              filtered.map((b) => (
                <BrandCard
                  key={b.id}
                  brand={b}
                  selected={selected.has(b.id)}
                  onToggle={() => toggleBrand(b.id)}
                  onScrape={() => handleScrape(b.id)}
                />
              ))
            )}
          </div>
        </div>
      )}

      {subTab === "discover" && (
        <DiscoverTab
          brands={brands}
          pageUrl={pageUrl}
          onBrandAdded={(b) => setBrands((prev) => [b, ...prev])}
          onToast={onToast}
        />
      )}

      {subTab === "scan" && (
        <ScrapeTab
          domain={domain}
          pageUrl={pageUrl}
          status={scanStatus}
          progress={scanProgress}
          offers={scanOffers}
          selected={scanSelected}
          saving={scanSaving}
          productConfig={productConfig}
          onProductConfigChange={onProductConfigChange}
          onScanPage={onScanPage}
          onCrawl={onCrawl}
          onStopScan={onStopScan}
          onSelectElements={onSelectElements}
          onToggle={onToggleOffer}
          onSelectAll={onSelectAll}
          onClearAll={onClearAll}
          onChange={onOfferChange}
          onSave={onSave}
        />
      )}
    </div>
  );
}
