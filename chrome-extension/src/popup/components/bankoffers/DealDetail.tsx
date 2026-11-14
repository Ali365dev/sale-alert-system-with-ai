import type { TakhfifBusinessDetail } from "../../../types/takhfif";

function Chevron() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-180">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function Collapse({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group bg-surface-2 border border-line rounded-lg">
      <summary className="flex items-center justify-between gap-2 px-2.5 py-1.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-[10px] font-bold text-t1">
        {summary}
        <span className="text-t3"><Chevron /></span>
      </summary>
      <div className="border-t border-line">{children}</div>
    </details>
  );
}

export function syncState(detail: TakhfifBusinessDetail): "synced" | "changed" | "unsynced" {
  if (!detail.pushedAt) return "unsynced";
  return detail.scrapedAt > detail.pushedAt ? "changed" : "synced";
}

export function DealDetailExpanded({ detail, busy, onPush }: {
  detail: TakhfifBusinessDetail; busy: boolean; onPush: (slug: string) => void;
}) {
  const isOpen = detail.openingStatus?.toLowerCase().includes("open");
  const sync = syncState(detail);
  return (
    <div className="px-2.5 pb-2.5 pt-2 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] text-t3">
          {sync === "synced" ? `Synced ${new Date(detail.pushedAt!).toLocaleString()}`
            : sync === "changed" ? "Re-scraped since last sync"
            : "Not saved to backend yet"}
        </span>
        <button
          onClick={() => onPush(detail.slug)}
          disabled={busy || sync === "synced"}
          aria-label={`Save ${detail.name} to backend`}
          className="flex-shrink-0 px-2.5 py-1 text-[9px] font-bold rounded-lg bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {sync === "synced" ? "Saved" : sync === "changed" ? "Update backend" : "Save to backend"}
        </button>
      </div>
      {detail.description && (
        <p className="text-[9px] text-t3 leading-relaxed line-clamp-2">{detail.description}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {detail.openingStatus && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded border ${isOpen ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-surface-2 border-line text-t3"}`}>
            {detail.openingStatus}{detail.closingTime ? ` · ${detail.closingTime}` : ""}
          </span>
        )}
        {detail.priceLevel && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-2 border border-line text-t2">{detail.priceLevel}</span>
        )}
        {detail.phone && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-2 border border-line text-t2">{detail.phone}</span>
        )}
        {detail.menuPages != null && (
          <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-2 border border-line text-t2">Menu · {detail.menuPages} pages</span>
        )}
      </div>

      {detail.banks.map((bank) => (
        <div key={bank.bankName} className="bg-surface-2 border border-line rounded-lg overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 border-b border-line">
            <p className="text-[10px] font-bold text-t1 truncate">
              {bank.bankName}
              {bank.maxDiscountPercentage != null && (
                <span className="ml-1.5 text-green-400">up to {bank.maxDiscountPercentage}%</span>
              )}
            </p>
            {bank.validityText && <span className="text-[8px] text-t3 truncate max-w-[110px] flex-shrink-0">{bank.validityText}</span>}
          </div>
          <div className="flex flex-col divide-y divide-line">
            {bank.tiers.flatMap((tier) =>
              tier.cards.map((card) => (
                <div key={`${tier.title}-${card.cardName}`} className="px-2.5 py-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] text-t2 truncate flex-1">{card.cardName}</p>
                    {card.discountPercentage != null && (
                      <span className="flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
                        {card.discountPercentage}% off
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 text-[8px] text-t3">
                    {tier.title && !/%\s*off/i.test(tier.title) && <span>{tier.title}</span>}
                    {card.maxDiscountText && <span>Max {card.maxDiscountText}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
          {bank.terms.length > 0 && (
            <details className="group border-t border-line">
              <summary className="flex items-center justify-between gap-2 px-2.5 py-1.5 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden text-[9px] font-semibold text-t2">
                Terms &amp; conditions ({bank.terms.length})
                <span className="text-t3"><Chevron /></span>
              </summary>
              <ul className="px-2.5 pb-2 flex flex-col gap-1">
                {bank.terms.map((t) => (
                  <li key={t} className="text-[8px] text-t3 leading-relaxed pl-2 border-l border-line">{t}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ))}

      {detail.branches.length > 0 && (
        <Collapse summary={`${detail.branches.length} branch${detail.branches.length !== 1 ? "es" : ""}`}>
          <ul className="flex flex-col divide-y divide-line">
            {detail.branches.map((b) => (
              <li key={b.name} className="flex items-start justify-between gap-2 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-semibold text-t1 truncate">{b.name}</p>
                  {b.address && <p className="text-[8px] text-t3 line-clamp-2">{b.address}</p>}
                </div>
                {b.directionsUrl && (
                  <a href={b.directionsUrl} target="_blank" rel="noreferrer"
                    className="flex-shrink-0 text-[8px] font-semibold text-primary hover:underline">
                    Directions
                  </a>
                )}
              </li>
            ))}
          </ul>
        </Collapse>
      )}

      {detail.openingHours && detail.openingHours.length > 0 && (
        <Collapse summary="Opening hours">
          <ul className="px-2.5 py-1.5 flex flex-col gap-0.5">
            {detail.openingHours.map((h) => (
              <li key={h.day} className="flex justify-between gap-3 text-[8px] text-t3">
                <span>{h.day}</span><span className="tabular-nums text-right">{h.hours}</span>
              </li>
            ))}
          </ul>
        </Collapse>
      )}

      {detail.warnings.length > 0 && (
        <p className="text-[8px] text-amber-400">{detail.warnings.length} warning(s) — see logs</p>
      )}
    </div>
  );
}
