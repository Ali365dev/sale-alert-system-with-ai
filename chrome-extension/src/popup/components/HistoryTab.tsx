import { useCallback, useEffect, useState } from "react";
import type { Job, ScrapeHistoryEntry, ApiOffer } from "../../types";
import { listJobs } from "../../services/jobsApi";
import { getHistory } from "../../services/storage";
import { getBrandOffers } from "../../services/brandsApi";

const STATUS_COLOR: Record<string, string> = {
  done: "bg-green-100 text-green-600",
  completed: "bg-green-100 text-green-600",
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
type MainTab = "jobs" | "sessions";

export function HistoryTab() {
  const [mainTab, setMainTab] = useState<MainTab>("jobs");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("website_scrape_brand");
  const [offset, setOffset] = useState(0);
  const [sessions, setSessions] = useState<ScrapeHistoryEntry[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState<number | null>(null);
  const [jobOffers, setJobOffers] = useState<Record<number, ApiOffer[] | "loading" | "error">>({});
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

  useEffect(() => {
    if (mainTab !== "sessions") return;
    setSessionsLoading(true);
    getHistory().then((h) => { setSessions(h); setSessionsLoading(false); }).catch(() => setSessionsLoading(false));
  }, [mainTab]);

  const toggleJobExpand = useCallback(async (job: Job) => {
    if (expandedJobId === job.id) { setExpandedJobId(null); return; }
    setExpandedJobId(job.id);
    const brandId = job.payload?.brand_id as number | undefined;
    if (!brandId || jobOffers[job.id]) return;
    setJobOffers((prev) => ({ ...prev, [job.id]: "loading" }));
    try {
      const offers = await getBrandOffers(brandId);
      setJobOffers((prev) => ({ ...prev, [job.id]: offers }));
    } catch {
      setJobOffers((prev) => ({ ...prev, [job.id]: "error" }));
    }
  }, [expandedJobId, jobOffers]);

  const FILTERS: { id: FilterType; label: string }[] = [
    { id: "website_scrape_brand", label: "Scrapes" },
    { id: "brand_discovery", label: "Discovery" },
    { id: "running", label: "Running" },
    { id: "failed", label: "Failed" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Main tab switcher */}
      <div className="flex border-b border-gray-200 bg-white flex-shrink-0">
        {(["jobs", "sessions"] as MainTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setMainTab(t)}
            className={`flex-1 py-2 text-[10px] font-bold transition relative ${
              mainTab === t ? "text-primary" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            {mainTab === t && (
              <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-primary rounded-t-full" />
            )}
            {t === "jobs" ? "Server Jobs" : "Sessions"}
          </button>
        ))}
      </div>

      {/* Filter chips (jobs tab only) */}
      {mainTab === "jobs" && (
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
      )}

      {/* Sessions tab */}
      {mainTab === "sessions" && (
        <div className="flex-1 overflow-y-auto">
          {sessionsLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <span className="text-3xl mb-2">🕐</span>
              <p className="text-xs font-semibold text-gray-500">No scrape sessions yet</p>
              <p className="text-[10px] text-gray-400 mt-1">Sessions appear after you scan a page.</p>
            </div>
          ) : (
            <div className="flex flex-col divide-y divide-gray-100">
              {sessions.map((s) => (
                <div key={s.id} className="px-3 py-2.5 bg-white hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-dark truncate">{s.domain || s.url}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(s.startedAt)}</p>
                    </div>
                    <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                      s.status === "done" ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
                    }`}>
                      {s.status}
                    </span>
                  </div>
                  <div className="flex gap-2.5 mt-1 text-[10px] text-gray-400">
                    <span className="uppercase font-semibold">{s.mode}</span>
                    {s.offersFound > 0 && <span>{s.offersFound} found</span>}
                    {s.offersSaved > 0 && <span className="text-green-500">{s.offersSaved} saved</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Jobs tab */}
      {mainTab === "jobs" && (<>
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
              const isExpanded = expandedJobId === job.id;
              const offers = jobOffers[job.id];
              const hasBrand = job.payload?.brand_id != null;
              return (
                <div key={job.id} className="bg-white">
                  <button
                    onClick={() => toggleJobExpand(job)}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
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
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${STATUS_COLOR[job.status] ?? "bg-gray-100 text-gray-500"}`}>
                          {job.status}
                        </span>
                        {hasBrand && (
                          <span className="text-[10px] text-gray-400">{isExpanded ? "▲" : "▼"}</span>
                        )}
                      </div>
                    </div>
                    {/* Stats */}
                    <div className="flex gap-2.5 mt-1 text-[10px] text-gray-400">
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
                  </button>

                  {/* Expanded offers panel */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
                      {offers === "loading" && (
                        <div className="flex justify-center py-4">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                      {offers === "error" && (
                        <p className="text-[10px] text-red-400 text-center py-2">Failed to load offers.</p>
                      )}
                      {!offers && !hasBrand && (
                        <p className="text-[10px] text-gray-400 text-center py-2">No brand linked to this job.</p>
                      )}
                      {Array.isArray(offers) && offers.length === 0 && (
                        <p className="text-[10px] text-gray-400 text-center py-2">No offers saved for this brand yet.</p>
                      )}
                      {Array.isArray(offers) && offers.length > 0 && (
                        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                          {offers.map((o) => (
                            <div key={o.id} className="bg-white rounded-lg p-2 border border-gray-100">
                              <p className="text-[10px] font-semibold text-dark truncate">{o.title ?? "Untitled offer"}</p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {o.discount_percentage && (
                                  <span className="px-1.5 py-0.5 bg-primary text-white text-[9px] font-bold rounded">
                                    {o.discount_percentage}% OFF
                                  </span>
                                )}
                                {o.coupon_code && (
                                  <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded font-mono">
                                    {o.coupon_code}
                                  </span>
                                )}
                                {o.category && (
                                  <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[9px] rounded">
                                    {o.category}
                                  </span>
                                )}
                                <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                                  o.is_active ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"
                                }`}>
                                  {o.is_active ? "active" : "inactive"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
      </>)}
    </div>
  );
}
