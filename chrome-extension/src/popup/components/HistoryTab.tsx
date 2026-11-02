import { useCallback, useEffect, useState } from "react";
import type { Job } from "../../types";
import { listJobs } from "../../services/jobsApi";

const STATUS_COLOR: Record<string, string> = {
  done: "bg-green-100 text-green-600",
  running: "bg-blue-100 text-blue-700",
  failed: "bg-red-100 text-red-500",
  pending: "bg-yellow-100 text-yellow-700",
  cancelled: "bg-gray-100 text-gray-500",
  cancelling: "bg-orange-100 text-orange-600",
};

const JOB_TYPE_LABEL: Record<string, string> = {
  website_scrape_brand: "🕷 Brand Scrape",
  brand_discovery: "🔍 Discovery",
  email_sync: "📧 Email Sync",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

type FilterType = "all" | "website_scrape_brand" | "brand_discovery" | "running" | "failed";

export function HistoryTab() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("website_scrape_brand");
  const [offset, setOffset] = useState(0);
  const PAGE = 20;

  const load = useCallback(async (f: FilterType, off: number) => {
    setLoading(true);
    try {
      const jobType = f === "running" || f === "failed" ? "website_scrape_brand" : f === "all" ? undefined : f;
      const status = f === "running" ? "running" : f === "failed" ? "failed" : undefined;
      const result = await listJobs({ jobType, status, limit: PAGE, offset: off });
      setJobs(result.jobs);
      setTotal(result.total);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(filter, 0); setOffset(0); }, [filter, load]);

  const FILTERS: { id: FilterType; label: string }[] = [
    { id: "website_scrape_brand", label: "Scrapes" },
    { id: "brand_discovery", label: "Discovery" },
    { id: "running", label: "Running" },
    { id: "failed", label: "Failed" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Filter chips */}
      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto flex-shrink-0">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`flex-shrink-0 px-2.5 py-1 text-[10px] font-bold rounded-full transition ${
              filter === f.id
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center px-4">
            <span className="text-3xl mb-2">📋</span>
            <p className="text-xs font-semibold text-gray-500">No jobs found</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-gray-100">
            {jobs.map((job) => {
              const brandName = (job.payload?.brand_name as string | undefined)
                ?? (job.payload?.brand_id != null ? `Brand #${job.payload.brand_id}` : null);
              return (
                <div key={job.id} className="px-3 py-2.5 bg-white hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold text-dark">
                          {JOB_TYPE_LABEL[job.job_type] ?? job.job_type}
                        </span>
                        {brandName && (
                          <span className="text-[10px] text-gray-500 truncate">— {brandName}</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(job.started_at ?? job.created_at)}</p>
                    </div>
                    <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${STATUS_COLOR[job.status] ?? "bg-gray-100 text-gray-500"}`}>
                      {job.status}
                    </span>
                  </div>
                  {/* Stats */}
                  <div className="flex gap-2.5 mt-1.5 text-[10px] text-gray-400">
                    {job.progress_percentage != null && job.status !== "done" && (
                      <span>{Math.round(job.progress_percentage)}%</span>
                    )}
                    {(job.successful ?? 0) > 0 && <span className="text-green-500">{job.successful} saved</span>}
                    {(job.processed_items ?? 0) > 0 && <span>{job.processed_items} processed</span>}
                    {(job.failed ?? 0) > 0 && <span className="text-red-400">{job.failed} failed</span>}
                  </div>
                  {job.error && (
                    <p className="mt-1 text-[10px] text-red-400 line-clamp-1">{job.error}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 flex-shrink-0 text-[10px] text-gray-400">
          <button
            disabled={offset === 0}
            onClick={() => { const o = Math.max(0, offset - PAGE); setOffset(o); load(filter, o); }}
            className="disabled:opacity-40 font-semibold hover:text-dark transition"
          >
            ← Prev
          </button>
          <span>{offset + 1}–{Math.min(offset + PAGE, total)} of {total}</span>
          <button
            disabled={offset + PAGE >= total}
            onClick={() => { const o = offset + PAGE; setOffset(o); load(filter, o); }}
            className="disabled:opacity-40 font-semibold hover:text-dark transition"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
