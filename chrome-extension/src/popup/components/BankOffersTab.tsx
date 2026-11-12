import { useEffect, useState } from "react";
import type {
  TakhfifConfigSnapshot, TakhfifListing, TakhfifLogEntry, TakhfifSession,
} from "../../types/takhfif";
import { Toggle, PhaseCard, StatCard } from "./bankoffers/primitives";
import type { PhaseStatus } from "./bankoffers/primitives";
import { CompletionPanel, LogsPanel, ResultsPanel } from "./bankoffers/panels";
import { exportListingsCsv, exportListingsJson } from "./bankoffers/exporters";
import {
  AlertIcon, BankIcon, BuildingIcon, CardIcon, ChevronDownIcon, ChevronUpIcon,
  ExternalLinkIcon, GlobeIcon, PlayIcon,
} from "./bankoffers/icons";

// Mirror of the keys owned by background/takhfif-listing.ts (kept as literals —
// the shared types module must stay type-only for content-script bundling).
const KEYS = {
  session: "dm_takhfif_session",
  listings: "dm_takhfif_listings",
  logs: "dm_takhfif_logs",
} as const;

const OPTIONS_KEY = "dm_takhfif_options";

interface TakhfifOptions {
  scrapeAllPages: boolean;
  scrapeDetails: boolean;
  maxPages: number;
  delaySeconds: number;
  maxRetries: number;
  timeoutSec: number;
}

const DEFAULT_OPTIONS: TakhfifOptions = {
  scrapeAllPages: true,
  scrapeDetails: true,
  maxPages: 5,
  delaySeconds: 1.5,
  maxRetries: 2,
  timeoutSec: 30,
};

interface Props {
  onToast: (type: "success" | "error" | "info", text: string) => void;
}

const HEADER_CHIP: Record<string, string> = {
  idle:      "bg-green-500/10 text-green-400 border-green-500/20",
  running:   "bg-amber-500/10 text-amber-400 border-amber-500/20",
  paused:    "bg-orange-500/10 text-orange-400 border-orange-500/20",
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  stopped:   "bg-surface-3 text-t3 border-line",
  failed:    "bg-red-500/10 text-red-400 border-red-500/20",
};

const HEADER_LABEL: Record<string, string> = {
  idle: "Ready", running: "Running", paused: "Paused",
  completed: "Done", stopped: "Stopped", failed: "Failed",
};

export function BankOffersTab({ onToast }: Props) {
  const [options, setOptions] = useState<TakhfifOptions>(DEFAULT_OPTIONS);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [session, setSession] = useState<TakhfifSession | null>(null);
  const [listings, setListings] = useState<TakhfifListing[]>([]);
  const [logs, setLogs] = useState<TakhfifLogEntry[]>([]);
  const [busy, setBusy] = useState(false);

  // Load persisted options + session state, then stay live via storage events
  useEffect(() => {
    chrome.storage.local.get([OPTIONS_KEY, KEYS.session, KEYS.listings, KEYS.logs], (r) => {
      if (r[OPTIONS_KEY]) setOptions((prev) => ({ ...prev, ...(r[OPTIONS_KEY] as Partial<TakhfifOptions>) }));
      setSession((r[KEYS.session] as TakhfifSession) ?? null);
      setListings((r[KEYS.listings] as TakhfifListing[]) ?? []);
      setLogs((r[KEYS.logs] as TakhfifLogEntry[]) ?? []);
    });
    const onChange = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== "local") return;
      if (changes[KEYS.session]) setSession((changes[KEYS.session].newValue as TakhfifSession) ?? null);
      if (changes[KEYS.listings]) setListings((changes[KEYS.listings].newValue as TakhfifListing[]) ?? []);
      if (changes[KEYS.logs]) setLogs((changes[KEYS.logs].newValue as TakhfifLogEntry[]) ?? []);
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, []);

  const saveOptions = (patch: Partial<TakhfifOptions>) => {
    setOptions((prev) => {
      const next = { ...prev, ...patch };
      chrome.storage.local.set({ [OPTIONS_KEY]: next });
      return next;
    });
  };

  const sendCmd = (msg: Record<string, unknown>, okText?: string) => {
    setBusy(true);
    chrome.runtime.sendMessage(msg, (res: { ok: boolean; error?: string } | undefined) => {
      setBusy(false);
      if (chrome.runtime.lastError || !res?.ok) {
        onToast("error", res?.error ?? "Command failed — reload the extension and try again.");
      } else if (okText) {
        onToast("info", okText);
      }
    });
  };

  const handleStart = () => {
    const config: TakhfifConfigSnapshot = {
      scrapeAllPages: options.scrapeAllPages,
      maxPages: options.maxPages,
      detailsEnabled: options.scrapeDetails,
      delaySeconds: options.delaySeconds,
      maxRetries: options.maxRetries,
      navTimeoutMs: options.timeoutSec * 1000,
    };
    sendCmd({ type: "TAKHFIF_LISTING_START", config }, "Listing scraping started.");
  };

  const handleNewSession = () => {
    if (!window.confirm("Clear the current session and its extracted listings? Export them first if you need them.")) return;
    sendCmd({ type: "TAKHFIF_SESSION_CLEAR" }, "Session cleared.");
  };

  const handleStartDetails = () => {
    onToast("info",
      `Detail scraping (Phase 2) is coming next — queue of ${session?.phase2.queueSize ?? 0} businesses is saved and ready.`);
  };

  const p1 = session?.phase1 ?? null;
  const status = p1?.status ?? "idle";
  const detailsEnabled = session ? session.config.detailsEnabled : options.scrapeDetails;

  const phase1Status: PhaseStatus =
    status === "idle" ? "ready" :
    status === "completed" ? "done" :
    status as PhaseStatus;

  const phase2Status: PhaseStatus =
    !detailsEnabled ? "skipped" :
    session?.phase2.status === "ready" ? "queued" : "waiting";

  const phase1Pct = p1?.totalPages
    ? (p1.pagesCompleted / p1.totalPages) * 100
    : status === "completed" ? 100 : 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="scrollable">
        {/* ── Header ── */}
        <div className="px-3 pt-3 pb-2 flex items-start justify-between">
          <div>
            <p className="text-[13px] font-black text-t1 uppercase tracking-[0.08em]">Bank Offers</p>
            <p className="text-[10px] text-t2 mt-0.5">Automated promotional offer extraction</p>
          </div>
          <span className={`text-[9px] font-bold px-2 py-1 rounded-full border mt-0.5 ${HEADER_CHIP[status]}`}>
            {HEADER_LABEL[status]}
          </span>
        </div>

        {/* ── Source card ── */}
        <div className="mx-3 mb-2.5 bg-surface border border-line rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-t2"><GlobeIcon /></span>
              <span className="text-[11px] font-bold text-t1">Takhfif.app</span>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
              Configured · Automated
            </span>
          </div>
          <a
            href="https://takhfif.app/deals" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline mt-1.5"
          >
            https://takhfif.app/deals
            <ExternalLinkIcon />
          </a>
        </div>

        {/* ── Scraping options ── */}
        <div className="mx-3 mb-2.5 bg-surface border border-line rounded-xl overflow-hidden">
          <div className="p-3 flex flex-col gap-3 divide-y divide-line">
            <Toggle
              on={options.scrapeAllPages}
              onChange={(v) => saveOptions({ scrapeAllPages: v })}
              label="Scrape all pages"
              description="Automatically process pagination until the last page"
            />
            {!options.scrapeAllPages && (
              <div className="pt-2.5 flex items-center gap-2">
                <span className="text-[10px] text-t2 flex-1">Max pages</span>
                <input
                  type="number" min={1} max={500} value={options.maxPages}
                  onChange={(e) => saveOptions({ maxPages: Math.min(500, Math.max(1, +e.target.value || 1)) })}
                  className="w-16 text-[11px] px-2 py-1.5 border border-line rounded-lg bg-surface-2 text-t1 outline-none focus:border-primary"
                />
              </div>
            )}
            <div className="pt-3">
              <Toggle
                on={options.scrapeDetails}
                onChange={(v) => saveOptions({ scrapeDetails: v })}
                label="Deal Details Scraping"
                description="Prepare a detail queue for bank cards, discounts and terms"
                badge={options.scrapeDetails ? "Full Scraping" : undefined}
              />
              {!options.scrapeDetails && (
                <p className="text-[10px] text-t3 mt-2">
                  Detail scraping disabled. Only deal listings will be extracted.
                </p>
              )}
            </div>
          </div>
          {status === "running" && (
            <p className="px-3 pb-2 text-[9px] text-t3">Option changes apply to the next session.</p>
          )}
          <button
            onClick={() => setAdvancedOpen((v) => !v)}
            className="w-full flex items-center gap-1.5 px-3 py-2 border-t border-line text-[10px] text-t2 hover:text-t1 transition"
          >
            <span>Advanced settings</span>
            {advancedOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </button>
          {advancedOpen && (
            <div className="px-3 pb-3 flex flex-col gap-2">
              {([
                ["Delay between pages (s)", "delaySeconds", 0, 10, 0.5],
                ["Max retries per page", "maxRetries", 0, 5, 1],
                ["Navigation timeout (s)", "timeoutSec", 10, 60, 5],
              ] as [string, keyof TakhfifOptions, number, number, number][]).map(([label, key, min, max, step]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-[10px] text-t2 flex-1">{label}</span>
                  <input
                    type="number" min={min} max={max} step={step}
                    value={options[key] as number}
                    onChange={(e) => saveOptions({ [key]: Math.min(max, Math.max(min, +e.target.value || min)) })}
                    className="w-16 text-[11px] px-2 py-1.5 border border-line rounded-lg bg-surface-2 text-t1 outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Action controls ── */}
        <div className="mx-3 mb-2.5 flex gap-2">
          {status === "idle" && (
            <button
              onClick={handleStart} disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-[11px] font-black rounded-xl transition tracking-wider"
            >
              <PlayIcon />
              {busy ? "Starting…" : "START LISTING SCRAPING"}
            </button>
          )}
          {status === "running" && (
            <>
              <button
                onClick={() => sendCmd({ type: "TAKHFIF_LISTING_PAUSE" }, "Pausing after the current page…")}
                disabled={busy}
                className="flex-1 py-2.5 bg-surface border border-line hover:border-amber-500/40 text-amber-400 text-[11px] font-bold rounded-xl transition"
              >
                Pause
              </button>
              <button
                onClick={() => sendCmd({ type: "TAKHFIF_LISTING_STOP" }, "Stopping…")}
                disabled={busy}
                className="flex-1 py-2.5 bg-surface border border-line hover:border-red-500/40 text-red-400 text-[11px] font-bold rounded-xl transition"
              >
                Stop
              </button>
            </>
          )}
          {status === "paused" && (
            <>
              <button
                onClick={() => sendCmd({ type: "TAKHFIF_LISTING_RESUME" }, "Resuming…")}
                disabled={busy}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-[11px] font-black rounded-xl transition"
              >
                <PlayIcon /> Resume
              </button>
              <button
                onClick={() => sendCmd({ type: "TAKHFIF_LISTING_STOP" })}
                disabled={busy}
                className="flex-1 py-2.5 bg-surface border border-line hover:border-red-500/40 text-red-400 text-[11px] font-bold rounded-xl transition"
              >
                Stop
              </button>
            </>
          )}
          {(status === "completed" || status === "stopped" || status === "failed") && (
            <button
              onClick={handleNewSession} disabled={busy}
              className="flex-1 py-2.5 bg-surface border border-primary/30 hover:border-primary text-primary text-[11px] font-bold rounded-xl transition"
            >
              Start New Session
            </button>
          )}
        </div>

        {status === "failed" && p1?.error && (
          <p className="mx-3 mb-2.5 text-[10px] text-red-400">{p1.error}</p>
        )}

        {/* ── Phase 1 completion summary + manual Phase 2 handoff ── */}
        {status === "completed" && session && (
          <CompletionPanel session={session} onStartDetails={handleStartDetails} />
        )}

        {/* ── Scraping Progress ── */}
        <div className="mx-3 mb-2.5">
          <p className="text-[10px] font-black text-t1 uppercase tracking-wider mb-2">Scraping Progress</p>
          <div className="flex flex-col gap-2">
            <PhaseCard
              phase="01" title="Deal Listings"
              description="Extract business cards from Takhfif.app"
              status={phase1Status}
              progressPct={phase1Pct}
              leftStat={`Page ${p1?.currentPage ?? 0}${p1?.totalPages ? ` of ${p1.totalPages}` : ""}`}
              rightStat={`${p1?.saved ?? 0} deals`}
              label={p1?.currentLabel}
            />
            <PhaseCard
              phase="02" title="Deal Details"
              description="Visit business pages and extract bank-card offers — starts only on your action"
              status={phase2Status}
              progressPct={0}
              leftStat={session?.phase2.status === "ready"
                ? `${session.phase2.queueSize} businesses queued`
                : "0 / 0 businesses"}
              rightStat="0 offers"
              label={session?.phase2.status === "ready" ? "Waiting for user action" : undefined}
              disabled={!detailsEnabled}
            />
          </div>
        </div>

        {/* ── Stats grid ── */}
        <div className="mx-3 mb-2.5 grid grid-cols-2 gap-2">
          <StatCard icon={<BuildingIcon />} label="Places Scraped" value={listings.length} />
          <StatCard icon={<BankIcon />} label="Bank Offers" value={detailsEnabled ? "–" : "N/A"} faded={!detailsEnabled} />
          <StatCard icon={<CardIcon />} label="Cards Found" value={detailsEnabled ? "–" : "N/A"} faded={!detailsEnabled} />
          <StatCard icon={<AlertIcon />} label="Failed Pages" value={p1?.failedPages.length ?? 0} />
        </div>

        {/* ── Results ── */}
        <ResultsPanel
          listings={listings}
          failedPages={p1?.failedPages ?? []}
          detailsEnabled={detailsEnabled}
        />

        {/* ── Export ── */}
        <div className="mx-3 mb-2.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-t2">Export listings</span>
          <div className="flex gap-1.5">
            <button
              disabled={!listings.length}
              onClick={() => exportListingsJson(listings)}
              title={listings.length ? "Export listings as JSON" : "No listings extracted yet"}
              className="px-2.5 py-1.5 text-[10px] font-bold bg-surface border border-line rounded-lg text-t2 hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              JSON
            </button>
            <button
              disabled={!listings.length}
              onClick={() => exportListingsCsv(listings)}
              title={listings.length ? "Export listings as CSV" : "No listings extracted yet"}
              className="px-2.5 py-1.5 text-[10px] font-bold bg-surface border border-line rounded-lg text-t2 hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              CSV
            </button>
          </div>
        </div>

        {/* ── Activity log ── */}
        <LogsPanel logs={logs} />

        <div className="h-4" />
      </div>
    </div>
  );
}
