import { useState } from "react";
import type {
  TakhfifBusinessDetail, TakhfifDetailMode, TakhfifHealth,
  TakhfifLogEntry, TakhfifSession,
} from "../../../types/takhfif";
import { ChevronDownIcon, ChevronUpIcon, ExternalLinkIcon, GlobeIcon } from "./icons";
import { exportBusinessesJson, exportOffersCsv, flattenOffers } from "./exporters";

const HEALTH_META: Record<TakhfifHealth["status"], { label: string; cls: string }> = {
  healthy:               { label: "Healthy",               cls: "bg-green-500/10 text-green-400 border-green-500/20" },
  slow:                  { label: "Slow Response",         cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  rate_limited:          { label: "Rate Limited",          cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  access_restricted:     { label: "Access Restricted",     cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  verification_required: { label: "Verification Required", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
  connection_error:      { label: "Connection Error",      cls: "bg-red-500/10 text-red-400 border-red-500/20" },
};

export function HealthPanel({ health, phaseLabel }: { health: TakhfifHealth; phaseLabel: string }) {
  const meta = HEALTH_META[health.status] ?? HEALTH_META.healthy;
  const rows: [string, string | number][] = [
    ["Phase", phaseLabel],
    ["Successful loads", health.okLoads],
    ["Failed loads", health.failedLoads],
    ["Rate-limit events", health.rateLimitEvents],
    ["Current delay", `${(health.currentDelayMs / 1000).toFixed(1)}s`],
    ["Last success", health.lastSuccessAt ? new Date(health.lastSuccessAt).toLocaleTimeString() : "—"],
  ];
  return (
    <div className="mx-3 mb-2.5 bg-surface border border-line rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-black text-t1 uppercase tracking-wider">Website Health</span>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-[10px]">
            <span className="text-t2">{label}</span>
            <span className="text-t1 font-semibold">{value}</span>
          </div>
        ))}
      </div>
      {health.lastError && (
        <p className="mt-2 text-[9px] text-red-400 truncate" title={health.lastError}>
          Last error: {health.lastError}
        </p>
      )}
    </div>
  );
}

export function SourceCard() {
  return (
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
  );
}

export function ExportBar({ details }: {
  details: Record<string, TakhfifBusinessDetail>;
}) {
  const btn = "px-2.5 py-1.5 text-[10px] font-bold bg-surface border border-line rounded-lg text-t2 hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition";
  const hasDetails = Object.keys(details).length > 0;
  return (
    <div className="mx-3 mb-2.5 flex items-center justify-between gap-2">
      <span className="text-[10px] font-semibold text-t2 flex-shrink-0">Export</span>
      <div className="flex gap-1.5 flex-wrap justify-end">
        <button disabled={!hasDetails} onClick={() => exportOffersCsv(flattenOffers(details))}
          title={hasDetails ? "Export all card offers as CSV" : "Run detail scraping first"} className={btn}>Offers CSV</button>
        <button disabled={!hasDetails} onClick={() => exportBusinessesJson(details)}
          title={hasDetails ? "Export businesses JSON" : "Run detail scraping first"} className={btn}>Businesses JSON</button>
      </div>
    </div>
  );
}

const MODES: { value: TakhfifDetailMode; label: string; desc: string }[] = [
  { value: "new", label: "Remaining only", desc: "Skip businesses that already have card offer details" },
  { value: "all", label: "All deals", desc: "Re-scrape every business from the beginning" },
];

export function CompletionPanel({ session, onStartDetails }: {
  session: TakhfifSession; onStartDetails: (mode: TakhfifDetailMode) => void;
}) {
  const [mode, setMode] = useState<TakhfifDetailMode>("new");
  const p1 = session.phase1;
  const rows: [string, string | number][] = [
    ["Pages processed", p1.pagesCompleted],
    ["Businesses discovered", p1.discovered],
    ["Successfully extracted", p1.saved],
    ["Duplicates skipped", p1.duplicates],
    ["Failed pages", p1.failedPages.length],
    ["Unique detail URLs", session.phase2.queueSize],
  ];
  const detailsIdle = ["ready", "completed", "stopped", "failed"].includes(session.phase2.status);
  return (
    <div className="mx-3 mb-2.5 bg-green-500/5 border border-green-500/25 rounded-xl p-3">
      <p className="text-[10px] font-black text-green-400 uppercase tracking-wider">Listing scraping completed</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-[10px]">
            <span className="text-t2">{label}</span>
            <span className="text-t1 font-bold">{value}</span>
          </div>
        ))}
      </div>
      {session.phase2.status === "disabled" ? (
        <p className="text-[10px] text-t3 mt-2.5">
          Listing extraction completed. Deal detail scraping was disabled.
        </p>
      ) : detailsIdle ? (
        <>
          <p className="text-[10px] text-t2 mt-2.5">Detail scraping queue prepared — waiting for your action.</p>
          <div className="mt-2 flex items-center gap-2">
            <label className="flex-shrink-0 text-[10px] text-t2" htmlFor="takhfif-detail-mode">Mode</label>
            <select
              id="takhfif-detail-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as TakhfifDetailMode)}
              className="flex-1 text-[11px] px-2 py-1.5 border border-line rounded-lg bg-surface-2 text-t1 outline-none focus:border-primary"
            >
              {MODES.map((m) => <option key={m.value} value={m.value} title={m.desc}>{m.label}</option>)}
            </select>
          </div>
          <button
            onClick={() => onStartDetails(mode)}
            className="mt-2 w-full py-2.5 bg-primary hover:bg-primary-dark text-white text-[11px] font-black rounded-xl transition tracking-wider"
          >
            START DETAIL SCRAPING
          </button>
        </>
      ) : null}
    </div>
  );
}

export function LogsPanel({ logs }: { logs: TakhfifLogEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-3 mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-surface border border-line rounded-xl text-[10px] font-bold text-t2 hover:text-t1 transition"
      >
        <span>SCRAPING ACTIVITY</span>
        <span className="flex items-center gap-1">
          {logs.length > 0 && <span>({logs.length})</span>}
          {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
        </span>
      </button>
      {open && (
        <div className="mt-1 bg-surface border border-line rounded-xl p-2 max-h-40 overflow-y-auto font-mono">
          {logs.length === 0
            ? <p className="text-[9px] text-t3 p-1">No activity yet.</p>
            : logs.map((entry, i) => (
              <div key={i} className="flex gap-2 text-[9px] leading-relaxed">
                <span className="text-t3 flex-shrink-0">[{entry.time}]</span>
                <span className={
                  entry.level === "success" ? "text-green-400" :
                  entry.level === "error" ? "text-red-400" :
                  entry.level === "warn" ? "text-amber-400" : "text-t2"
                }>{entry.message}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
