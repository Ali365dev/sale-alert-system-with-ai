import type { Brand } from "../../types";
import { Tooltip } from "./Tooltip";

interface Props {
  brand: Brand;
  selected: boolean;
  onToggle: () => void;
  onScrape: () => void;
}

const COUNTRY_FLAG: Record<string, string> = {
  PK: "🇵🇰", SA: "🇸🇦", AE: "🇦🇪", EG: "🇪🇬", QA: "🇶🇦",
  KW: "🇰🇼", US: "🇺🇸", GB: "🇬🇧", IN: "🇮🇳", TR: "🇹🇷",
};

function getDomain(url: string | null): string {
  if (!url) return "";
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace("www.", "");
  } catch {
    return url;
  }
}

function formatLastScraped(iso: string | null): string {
  if (!iso) return "Never scraped";
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export function BrandCard({ brand, selected, onToggle, onScrape }: Props) {
  const domain = getDomain(brand.website);
  const flag = brand.country ? (COUNTRY_FLAG[brand.country] ?? brand.country) : "";

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2.5 border-b border-line transition ${
        selected ? "bg-primary/5" : "hover:bg-surface-2"
      }`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="w-3.5 h-3.5 accent-primary flex-shrink-0 cursor-pointer"
        aria-label={`Select ${brand.name}`}
      />

      {/* Logo / initials */}
      <div className="w-[34px] h-[34px] flex-shrink-0 rounded-lg bg-surface-2 border border-line flex items-center justify-center overflow-hidden">
        {brand.logo_url ? (
          <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain p-0.5" />
        ) : (
          <span className="text-[11px] font-black text-primary">
            {brand.name.slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[11px] font-bold text-t1 truncate">{brand.name}</p>
          {flag && <span className="text-xs flex-shrink-0">{flag}</span>}
          {!brand.is_active && (
            <span className="text-[9px] px-1 py-0.5 bg-surface-3 text-t2 rounded font-bold flex-shrink-0">
              inactive
            </span>
          )}
        </div>
        <p className="text-[10px] text-t2 mt-0.5 truncate">
          {formatLastScraped(brand.last_searched)}
          {domain && <span> · {domain}</span>}
        </p>
      </div>

      {/* Right side: offer chip + visit + scrape */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {typeof (brand as Brand & { offer_count?: number }).offer_count === "number" && (
          <span className="px-1.5 py-0.5 text-[8.5px] font-bold rounded-md bg-green-500/[0.07] border border-green-500/20 text-green-400">
            {(brand as Brand & { offer_count?: number }).offer_count}
          </span>
        )}
        {domain && (
          <Tooltip text={`Visit ${domain}`} position="left">
            <button
              onClick={() => window.open(`https://${domain}`, "_blank")}
              aria-label={`Visit ${domain}`}
              className="w-[26px] h-[26px] flex items-center justify-center bg-surface-2 border border-line rounded-md text-t2 hover:text-t1 hover:border-t3 transition"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
            </button>
          </Tooltip>
        )}
        <Tooltip text={brand.website_scraping_enabled ? `Scrape ${brand.name}` : "Scraping disabled"} position="left">
          <button
            onClick={onScrape}
            disabled={!brand.website_scraping_enabled}
            aria-label={`Scrape ${brand.name}`}
            className="px-2 py-[5px] text-[8.5px] font-black bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-md transition uppercase tracking-wide"
          >
            Scrape
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
