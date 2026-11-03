import type { Job } from "../../types";
import { Tooltip } from "./Tooltip";

interface Props {
  job: Job;
  onCancel: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  running: "bg-blue-100 text-blue-700",
  cancelling: "bg-orange-100 text-orange-700",
  done: "bg-green-100 text-green-600",
  failed: "bg-red-100 text-red-500",
  cancelled: "bg-gray-100 text-gray-500",
};

export function JobStatusPanel({ job, onCancel }: Props) {
  const pct = job.progress_percentage ?? 0;
  const canCancel = job.status === "pending" || job.status === "running";
  const isTerminal = job.status === "done" || job.status === "failed" || job.status === "cancelled";

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

  return (
    <div className="mx-3 mt-2 bg-white border border-gray-200 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${STATUS_COLOR[job.status] ?? "bg-gray-100 text-gray-500"}`}
          >
            {job.status}
          </span>
          <p className="text-[10px] font-semibold text-dark truncate">
            {brandName ? `Scraping ${brandName}` : `Job #${job.id}`}
          </p>
        </div>
        {canCancel && (
          <Tooltip text="Cancel this scrape job" position="left">
            <button
              onClick={onCancel}
              aria-label="Cancel job"
              className="text-[10px] text-red-400 hover:text-red-600 font-bold flex-shrink-0 ml-2"
            >
              ✕ Cancel
            </button>
          </Tooltip>
        )}
      </div>

      {/* Progress bar */}
      {!isTerminal && (
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
      )}

      <p className="text-[10px] text-gray-400 truncate">{label}</p>

      {/* Stats row */}
      {(job.processed_items ?? 0) > 0 && (
        <div className="flex gap-3 mt-1.5 text-[10px] text-gray-400">
          <span>{job.processed_items} processed</span>
          {(job.successful ?? 0) > 0 && <span className="text-green-500">{job.successful} saved</span>}
          {(job.failed ?? 0) > 0 && <span className="text-red-400">{job.failed} failed</span>}
        </div>
      )}

      {job.status === "failed" && job.error && (
        <p className="mt-1.5 text-[10px] text-red-400 line-clamp-2">{job.error}</p>
      )}
    </div>
  );
}
