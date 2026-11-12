import { useState } from "react";
import type { TakhfifListing, TakhfifLogEntry, TakhfifSession } from "../../../types/takhfif";
import { ChevronDownIcon, ChevronUpIcon, DatabaseIcon, ExternalLinkIcon } from "./icons";

export function CompletionPanel({ session, onStartDetails }: {
  session: TakhfifSession; onStartDetails: () => void;
}) {
  const p1 = session.phase1;
  const rows: [string, string | number][] = [
    ["Pages processed", p1.pagesCompleted],
    ["Businesses discovered", p1.discovered],
    ["Successfully extracted", p1.saved],
    ["Duplicates skipped", p1.duplicates],
    ["Failed pages", p1.failedPages.length],
    ["Unique detail URLs", session.phase2.queueSize],
  ];
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
      {session.phase2.status === "ready" ? (
        <>
          <p className="text-[10px] text-t2 mt-2.5">Detail scraping queue prepared — waiting for your action.</p>
          <button
            onClick={onStartDetails}
            className="mt-2 w-full py-2.5 bg-primary hover:bg-primary-dark text-white text-[11px] font-black rounded-xl transition tracking-wider"
          >
            START DETAIL SCRAPING
          </button>
        </>
      ) : (
        <p className="text-[10px] text-t3 mt-2.5">
          Listing extraction completed. Deal detail scraping was disabled.
        </p>
      )}
    </div>
  );
}

function DealRow({ listing, detailsEnabled }: { listing: TakhfifListing; detailsEnabled: boolean }) {
  return (
    <div className="flex gap-2.5 p-2.5 items-center">
      {listing.logo_url
        ? <img src={listing.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover bg-surface-2 flex-shrink-0" />
        : <div className="w-8 h-8 rounded-lg bg-surface-2 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-bold text-t1 truncate">{listing.business_name}</p>
          {listing.rating != null && (
            <span className="text-[9px] text-amber-400 font-bold flex-shrink-0">★ {listing.rating}</span>
          )}
        </div>
        <p className="text-[9px] text-t3 truncate">
          {[listing.category, listing.location].filter(Boolean).join(" · ")}
        </p>
        <div className="flex gap-2 mt-0.5 text-[9px]">
          {listing.discount_text && <span className="text-green-400 font-semibold">{listing.discount_text}</span>}
          {listing.card_offer_count != null && <span className="text-t2">{listing.card_offer_count} card offers</span>}
          {listing.expiry_text && <span className="text-t3">{listing.expiry_text}</span>}
          {!detailsEnabled && <span className="text-t3">Details skipped</span>}
        </div>
      </div>
      <a
        href={listing.detail_url} target="_blank" rel="noreferrer"
        aria-label={`Open ${listing.business_name} on takhfif.app`}
        className="flex-shrink-0 text-t3 hover:text-primary transition p-1.5"
      >
        <ExternalLinkIcon />
      </a>
    </div>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-6 flex flex-col items-center gap-2 text-center">
      <span className="text-t3 opacity-40"><DatabaseIcon /></span>
      <p className="text-[11px] font-semibold text-t2">{title}</p>
      <p className="text-[10px] text-t3">{hint}</p>
    </div>
  );
}

const SHOW_LIMIT = 60;
type ResultTab = "all" | "offers" | "failed";

export function ResultsPanel({ listings, failedPages, detailsEnabled }: {
  listings: TakhfifListing[]; failedPages: number[]; detailsEnabled: boolean;
}) {
  const [tab, setTab] = useState<ResultTab>("all");
  const shown = listings.slice(0, SHOW_LIMIT);

  return (
    <div className="mx-3 mb-2.5">
      <p className="text-[10px] font-black text-t1 uppercase tracking-wider mb-2">Extracted Results</p>
      <div className="flex border-b border-line mb-3">
        {(["all", "offers", "failed"] as ResultTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-[10px] font-bold transition border-b-2 -mb-px ${
              tab === t ? "text-t1 border-primary" : "text-t3 border-transparent hover:text-t2"
            }`}
          >
            {t === "all" ? `All Deals${listings.length ? ` (${listings.length})` : ""}`
              : t === "offers" ? "Bank Offers"
              : `Failed${failedPages.length ? ` (${failedPages.length})` : ""}`}
          </button>
        ))}
      </div>

      {tab === "all" && (listings.length === 0
        ? <EmptyState title="No extracted deals yet" hint="Start listing scraping to populate results." />
        : (
          <div className="bg-surface border border-line rounded-xl overflow-hidden">
            <div className="flex flex-col divide-y divide-line max-h-80 overflow-y-auto">
              {shown.map((l) => <DealRow key={l.detail_url} listing={l} detailsEnabled={detailsEnabled} />)}
            </div>
            {listings.length > SHOW_LIMIT && (
              <p className="px-3 py-2 border-t border-line text-[9px] text-t3">
                Showing {SHOW_LIMIT} of {listings.length} — export to get the complete dataset.
              </p>
            )}
          </div>
        ))}

      {tab === "offers" && (
        <EmptyState
          title="No bank offers yet"
          hint={detailsEnabled
            ? "Bank/card offers are extracted in Phase 2 (detail scraping)."
            : "Deal details scraping is disabled — no bank offers will be extracted."}
        />
      )}

      {tab === "failed" && (failedPages.length === 0
        ? <EmptyState title="No failures" hint="Failed listing pages will appear here." />
        : (
          <div className="bg-surface border border-line rounded-xl divide-y divide-line">
            {failedPages.map((p) => (
              <div key={p} className="flex items-center justify-between p-2.5">
                <span className="text-[10px] text-t1 font-semibold">Listing page {p}</span>
                <span className="text-[9px] text-red-400">Failed after retries</span>
              </div>
            ))}
            <p className="p-2.5 text-[9px] text-t3">
              Failed pages are retried automatically during the session. Start a new session to re-scrape them.
            </p>
          </div>
        ))}
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
