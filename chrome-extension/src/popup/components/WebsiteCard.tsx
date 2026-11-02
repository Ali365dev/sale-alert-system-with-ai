import type { ScanStatus } from "../../types";

const STATUS_LABEL: Record<ScanStatus, string> = {
  idle: "Not scanned",
  scanning: "Scanning…",
  done: "Scanned",
  error: "Scan failed",
};

const STATUS_COLOR: Record<ScanStatus, string> = {
  idle: "text-gray-400",
  scanning: "text-yellow-500",
  done: "text-green-500",
  error: "text-red-500",
};

interface Props {
  domain: string;
  pageUrl: string;
  status: ScanStatus;
  offersCount: number;
  onRefresh: () => void;
}

export function WebsiteCard({ domain, pageUrl, status, offersCount, onRefresh }: Props) {
  const faviconUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32`
    : null;

  return (
    <div className="mx-3 mt-3 bg-white rounded-xl border border-gray-200 p-3 shadow-sm flex-shrink-0">
      <div className="flex items-center gap-2.5">
        {faviconUrl ? (
          <img
            src={faviconUrl}
            alt=""
            className="w-8 h-8 rounded-lg bg-gray-100 flex-shrink-0"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-gray-200 flex-shrink-0 flex items-center justify-center">
            <span className="text-gray-400 text-sm">🌐</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-dark truncate">
            {domain || "No page open"}
          </p>
          <p className="text-[10px] text-gray-400 truncate">
            {pageUrl || "Navigate to a website to begin"}
          </p>
        </div>

        <button
          onClick={onRefresh}
          aria-label="Refresh"
          disabled={!domain || status === "scanning"}
          className="text-gray-400 hover:text-primary disabled:opacity-30 transition p-1 rounded flex-shrink-0 text-base leading-none"
          title="Rescan page"
        >
          ↻
        </button>
      </div>

      <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
        <span className={`text-[10px] font-semibold ${STATUS_COLOR[status]}`}>
          ● {STATUS_LABEL[status]}
        </span>
        {offersCount > 0 && (
          <span className="text-[10px] text-gray-500">
            {offersCount} offer{offersCount !== 1 ? "s" : ""} found
          </span>
        )}
      </div>
    </div>
  );
}
