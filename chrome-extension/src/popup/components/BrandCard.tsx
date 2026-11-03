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
      className={`flex items-center gap-2.5 px-3 py-2.5 border-b border-gray-100 transition ${
        selected ? "bg-primary/5" : "bg-white hover:bg-gray-50"
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
      <div className="w-8 h-8 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
        {brand.logo_url ? (
          <img src={brand.logo_url} alt={brand.name} className="w-full h-full object-contain p-0.5" />
        ) : (
          <span className="text-[11px] font-bold text-gray-400">
            {brand.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-dark truncate">{brand.name}</p>
          {flag && <span className="text-xs flex-shrink-0">{flag}</span>}
          {!brand.is_active && (
            <span className="text-[9px] px-1 py-0.5 bg-gray-100 text-gray-400 rounded font-bold flex-shrink-0">
              inactive
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {domain && (
            <button
              onClick={() => window.open(`https://${domain}`, "_blank")}
              className="text-[10px] text-primary hover:underline truncate"
            >
              {domain}
            </button>
          )}
          <span className="text-[10px] text-gray-400 flex-shrink-0">
            {formatLastScraped(brand.last_searched)}
          </span>
        </div>
      </div>

      {/* Scrape button */}
      <Tooltip text={brand.website_scraping_enabled ? `Scrape ${brand.name}` : "Scraping disabled"} position="left">
        <button
          onClick={onScrape}
          disabled={!brand.website_scraping_enabled}
          aria-label={`Scrape ${brand.name}`}
          className="flex-shrink-0 px-2.5 py-1.5 text-[10px] font-bold bg-primary hover:bg-primary-dark disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg transition"
        >
          ⚡
        </button>
      </Tooltip>
    </div>
  );
}
