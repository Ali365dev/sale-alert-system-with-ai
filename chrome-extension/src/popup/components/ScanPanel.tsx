import type { ScanStatus } from "../../types";
import { ProgressBar } from "./ProgressBar";
import { triggerServerScrape } from "../../services/api";

interface Props {
  domain: string;
  pageUrl: string;
  status: ScanStatus;
  progress: number;
  offersCount: number;
  onScanPage: () => void;
  onRescan: () => void;
  addToast: (type: "success" | "error" | "info", text: string) => void;
}

const STATUS_DOT: Record<ScanStatus, string> = {
  idle: "bg-gray-300",
  scanning: "bg-yellow-400 animate-pulse",
  done: "bg-green-400",
  error: "bg-red-400",
};

const STATUS_LABEL: Record<ScanStatus, string> = {
  idle: "Ready",
  scanning: "Scanning…",
  done: "Done",
  error: "Error",
};

export function ScanPanel({
  domain,
  pageUrl,
  status,
  progress,
  offersCount,
  onScanPage,
  onRescan,
  addToast,
}: Props) {
  const handleServerScrape = async () => {
    try {
      const result = await triggerServerScrape(pageUrl);
      addToast("success", `Server scrape queued (job #${result.jobId})`);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Server scrape failed");
    }
  };

  return (
    <div className="flex flex-col gap-3 px-3">
      {/* Status bar */}
      <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-xl">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[status]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-dark truncate">{domain || "No page"}</p>
          <p className="text-[10px] text-gray-400">{STATUS_LABEL[status]}</p>
        </div>
        {offersCount > 0 && (
          <span className="px-2 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full">
            {offersCount}
          </span>
        )}
      </div>

      {/* Progress */}
      {status === "scanning" && (
        <ProgressBar progress={progress} label="Extracting offers…" />
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        {status === "idle" || status === "error" ? (
          <button
            onClick={onScanPage}
            disabled={!domain}
            className="flex-1 py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-sm"
          >
            Scan This Page
          </button>
        ) : status === "scanning" ? (
          <button
            disabled
            className="flex-1 py-2.5 bg-gray-100 text-gray-400 text-xs font-semibold rounded-xl cursor-not-allowed"
          >
            Scanning…
          </button>
        ) : (
          <button
            onClick={onRescan}
            className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
          >
            Rescan Page
          </button>
        )}

        <button
          onClick={handleServerScrape}
          disabled={!domain}
          title="Trigger a full server-side scrape via scraper_server"
          className="px-3 py-2.5 bg-dark hover:bg-gray-800 disabled:opacity-40 text-white text-xs font-semibold rounded-xl transition"
        >
          Server
        </button>
      </div>
    </div>
  );
}
