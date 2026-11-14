import { useMemo, useState } from "react";
import type { TakhfifBusinessDetail, TakhfifListing, TakhfifQueueItem } from "../../../types/takhfif";
import type { FlatOffer } from "./exporters";
import { DealDetailExpanded, syncState } from "./DealDetail";
import { ChevronDownIcon, ChevronUpIcon, DatabaseIcon, ExternalLinkIcon, ScrapeIcon } from "./icons";

const SYNC_CHIP = {
  synced:   { label: "Synced",     cls: "text-sky-400" },
  changed:  { label: "Sync stale", cls: "text-amber-400" },
  unsynced: { label: "Not synced", cls: "text-t3" },
} as const;

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="bg-surface border border-line rounded-xl p-6 flex flex-col items-center gap-2 text-center">
      <span className="text-t3 opacity-40"><DatabaseIcon /></span>
      <p className="text-[11px] font-semibold text-t2">{title}</p>
      <p className="text-[10px] text-t3">{hint}</p>
    </div>
  );
}

function DealRow({ listing, detail, hasDetail, detailsEnabled, canScrape, onScrapeOne, busy, onPushOne }: {
  listing: TakhfifListing; detail?: TakhfifBusinessDetail; hasDetail: boolean; detailsEnabled: boolean;
  canScrape: boolean; onScrapeOne: (url: string) => void;
  busy: boolean; onPushOne: (slug: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = hasDetail && !!detail;

  return (
    <div>
      <div
        className={`flex gap-2.5 p-2.5 items-center ${canExpand ? "cursor-pointer hover:bg-surface-2/50 transition-colors" : ""}`}
        onClick={canExpand ? () => setExpanded((v) => !v) : undefined}
        role={canExpand ? "button" : undefined}
        aria-expanded={canExpand ? expanded : undefined}
      >
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
            <span className={hasDetail ? "text-green-400" : "text-t3"}>
              {hasDetail ? "Details ✓" : detailsEnabled ? "Details pending" : "Details skipped"}
            </span>
            {detail && (
              <span className={SYNC_CHIP[syncState(detail)].cls}>
                {SYNC_CHIP[syncState(detail)].label}
              </span>
            )}
          </div>
        </div>
        {canExpand && (
          <span className="flex-shrink-0 text-t3 p-1">
            {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onScrapeOne(listing.detail_url); }}
          disabled={!canScrape}
          aria-label={`${hasDetail ? "Re-scrape" : "Scrape"} details for ${listing.business_name}`}
          title={canScrape
            ? `${hasDetail ? "Re-scrape" : "Scrape"} this business's bank offers`
            : "Wait for the current scrape to finish"}
          className="flex-shrink-0 text-t3 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed transition p-1.5"
        >
          <ScrapeIcon />
        </button>
        <a
          href={listing.detail_url} target="_blank" rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Open ${listing.business_name} on takhfif.app`}
          className="flex-shrink-0 text-t3 hover:text-primary transition p-1.5"
        >
          <ExternalLinkIcon />
        </a>
      </div>
      {expanded && detail && (
        <div className="border-t border-line bg-surface-2/30">
          <DealDetailExpanded detail={detail} busy={busy} onPush={onPushOne} />
        </div>
      )}
    </div>
  );
}

function OffersList({ offers }: { offers: FlatOffer[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return offers;
    return offers.filter((o) =>
      o.bank.toLowerCase().includes(q) || o.business.toLowerCase().includes(q) || o.card.toLowerCase().includes(q));
  }, [offers, query]);
  const shown = filtered.slice(0, 100);

  return (
    <div className="flex flex-col gap-2">
      <input
        type="search" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Search bank, business or card…"
        aria-label="Search card offers"
        className="text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 outline-none focus:border-primary"
      />
      {shown.length === 0
        ? <EmptyState title="No matching offers" hint={query ? "Try a different search." : "Run detail scraping to extract card offers."} />
        : (
          <div className="bg-surface border border-line rounded-xl overflow-hidden">
            <div className="flex flex-col divide-y divide-line max-h-80 overflow-y-auto">
              {shown.map((o, i) => (
                <div key={`${o.slug}-${o.bank}-${o.card}-${i}`} className="p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold text-t1 truncate">{o.card}</p>
                    {o.pct != null && (
                      <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                        {o.pct}% off
                      </span>
                    )}
                  </div>
                  <p className="text-[9px] text-t2 truncate">{o.bank} · {o.business}</p>
                  <div className="flex gap-2 mt-0.5 text-[9px] text-t3">
                    {o.maxDiscount && <span>Max {o.maxDiscount}</span>}
                    {o.validity && <span>{o.validity}</span>}
                  </div>
                </div>
              ))}
            </div>
            {filtered.length > 100 && (
              <p className="px-3 py-2 border-t border-line text-[9px] text-t3">
                Showing 100 of {filtered.length} — export CSV for the complete set.
              </p>
            )}
          </div>
        )}
    </div>
  );
}

const SHOW_LIMIT = 60;
type ResultTab = "all" | "offers" | "failed";

export function ResultsPanel({
  listings, offers, details, failedPages, failedItems, completedSlugs,
  detailsEnabled, canScrape, onRetryFailed, onScrapeOne, busy, onPushOne, onPushAll,
}: {
  listings: TakhfifListing[];
  offers: FlatOffer[];
  details: Record<string, TakhfifBusinessDetail>;
  failedPages: number[];
  failedItems: TakhfifQueueItem[];
  completedSlugs: Set<string>;
  detailsEnabled: boolean;
  canScrape: boolean;
  onRetryFailed: () => void;
  onScrapeOne: (url: string) => void;
  busy: boolean;
  onPushOne: (slug: string) => void;
  onPushAll: () => void;
}) {
  const [tab, setTab] = useState<ResultTab>("all");
  const shown = listings.slice(0, SHOW_LIMIT);
  const failedCount = failedPages.length + failedItems.length;
  const slugOf = (url: string) => url.split("/place/")[1]?.split(/[/?#]/)[0] ?? "";
  const unsynced = Object.values(details).filter((d) => syncState(d) !== "synced").length;

  return (
    <div className="mx-3 mb-2.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-black text-t1 uppercase tracking-wider">Extracted Results</p>
        {unsynced > 0 && (
          <button
            onClick={onPushAll}
            disabled={busy}
            aria-label={`Save ${unsynced} businesses to backend`}
            className="px-2.5 py-1 text-[9px] font-bold rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Save all to backend ({unsynced})
          </button>
        )}
      </div>
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
              : t === "offers" ? `Bank Offers${offers.length ? ` (${offers.length})` : ""}`
              : `Failed${failedCount ? ` (${failedCount})` : ""}`}
          </button>
        ))}
      </div>

      {tab === "all" && (listings.length === 0
        ? <EmptyState title="No extracted deals yet" hint="Start listing scraping to populate results." />
        : (
          <div className="bg-surface border border-line rounded-xl overflow-hidden">
            <div className="flex flex-col divide-y divide-line max-h-80 overflow-y-auto">
              {shown.map((l) => {
                const slug = slugOf(l.detail_url);
                return (
                  <DealRow key={l.detail_url} listing={l}
                    detail={details[slug]}
                    hasDetail={completedSlugs.has(slug)} detailsEnabled={detailsEnabled}
                    canScrape={canScrape} onScrapeOne={onScrapeOne}
                    busy={busy} onPushOne={onPushOne} />
                );
              })}
            </div>
            {listings.length > SHOW_LIMIT && (
              <p className="px-3 py-2 border-t border-line text-[9px] text-t3">
                Showing {SHOW_LIMIT} of {listings.length} — export to get the complete dataset.
              </p>
            )}
          </div>
        ))}

      {tab === "offers" && <OffersList offers={offers} />}

      {tab === "failed" && (failedCount === 0
        ? <EmptyState title="No failures" hint="Failed pages and businesses will appear here." />
        : (
          <div className="bg-surface border border-line rounded-xl divide-y divide-line">
            {failedPages.map((p) => (
              <div key={`page-${p}`} className="flex items-center justify-between p-2.5">
                <span className="text-[10px] text-t1 font-semibold">Listing page {p}</span>
                <span className="text-[9px] text-red-400">Failed after retries</span>
              </div>
            ))}
            {failedItems.slice(0, 50).map((item) => (
              <div key={item.detailUrl} className="p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-t1 font-semibold truncate">{item.businessName}</span>
                  <span className="flex-shrink-0 text-[9px] text-red-400">Detail scrape failed</span>
                </div>
                {item.error && <p className="text-[9px] text-t3 truncate mt-0.5">{item.error}</p>}
              </div>
            ))}
            {failedItems.length > 0 && (
              <div className="p-2.5">
                <button
                  onClick={onRetryFailed}
                  className="w-full py-2 bg-surface-2 border border-line hover:border-primary/40 text-primary text-[10px] font-bold rounded-lg transition"
                >
                  Retry {failedItems.length} failed business{failedItems.length !== 1 ? "es" : ""}
                </button>
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
