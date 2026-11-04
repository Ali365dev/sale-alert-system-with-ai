import type { Job } from "../../types";
import { Tooltip } from "./Tooltip";

interface Props {
  job: Job;
  onCancel: () => void;
  onViewHistory?: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-amber-500/[0.08] text-amber-400 border border-amber-500/20",
  running: "bg-blue-500/[0.08] text-blue-400 border border-blue-500/20",
  cancelling: "bg-orange-500/[0.08] text-orange-400 border border-orange-500/20",
  done: "bg-green-500/[0.08] text-green-400 border border-green-500/20",
  completed: "bg-green-500/[0.08] text-green-400 border border-green-500/20",
  failed: "bg-red-500/[0.08] text-red-400 border border-red-500/20",
  cancelled: "bg-t3/[0.08] text-t3 border border-line",
};

// For website_scrape_brand, "successful" means pages scraped OK (not individual offers inserted).
// Use a job-type-aware label so it doesn't mislead the user.
function successLabel(job: Job): string {
  if (job.job_type === "website_scrape_brand") return "pages scraped";
  return "saved";
}

export function JobStatusPanel({ job, onCancel, onViewHistory }: Props) {
  const pct = job.progress_percentage ?? 0;
  const canCancel = job.status === "pending" || job.status === "running";
  const isTerminal = job.status === "done" || job.status === "failed" || job.status === "cancelled" || job.status === "completed";

  const label = job.current_item_label
    ? job.current_item_label
    : job.stage
    ? job.stage
    : job.status === "pending"
    ? "Queued…"
    : job.status === "running"
    ? "Running…"
    : job.status;

  const brandName = (job.payload?.brand_name as string | undefined) ?? "";

  const panelContent = (
    <>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${STATUS_COLOR[job.status] ?? "bg-surface-3 text-t2"}`}
          >
            {job.status}
          </span>
          <p className="text-[10px] font-semibold text-t1 truncate">
            {brandName ? `Scraping ${brandName}` : `Job #${job.id}`}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {isTerminal && onViewHistory && (
            <Tooltip text="View in History" position="left">
              <button
                onClick={(e) => { e.stopPropagation(); onViewHistory(); }}
                className="text-[10px] text-primary hover:text-primary-dark font-bold"
              >
                History →
              </button>
            </Tooltip>
          )}
          {canCancel && (
            <Tooltip text="Cancel this scrape job" position="left">
              <button
                onClick={(e) => { e.stopPropagation(); onCancel(); }}
                aria-label="Cancel job"
                className="text-[10px] text-red-400 hover:text-red-300 font-bold"
              >
                ✕ Cancel
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {!isTerminal && (
        <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
      )}

      <p className="text-[10px] text-t2 truncate">{label}</p>

      {/* Stats row */}
      {(job.processed_items ?? 0) > 0 && (
        <div className="flex gap-3 mt-1.5 text-[10px] text-t2">
          <span>{job.processed_items} processed</span>
          {(job.successful ?? 0) > 0 && (
            <span className="text-green-400">{job.successful} {successLabel(job)}</span>
          )}
          {(job.failed ?? 0) > 0 && <span className="text-red-400">{job.failed} failed</span>}
        </div>
      )}

      {job.status === "failed" && job.error && (
        <p className="mt-1.5 text-[10px] text-red-400 line-clamp-2">{job.error}</p>
      )}
    </>
  );

  return (
    <div
      className={`mx-3 mt-2 bg-surface border border-line rounded-xl p-3 ${!isTerminal ? "shimmer-panel" : ""} ${isTerminal && onViewHistory ? "cursor-pointer hover:border-primary/40 transition" : ""}`}
      onClick={isTerminal && onViewHistory ? onViewHistory : undefined}
    >
      {panelContent}
    </div>
  );
}
