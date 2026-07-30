import { useEffect, useState } from "react";

import {
  isJobActive,
  useActiveJob,
  useBulkJobAction,
  useDeleteJob,
  useJobHistory,
  useJobsSummary,
  useRetryJob,
  useStartJob,
  type Job,
} from "../api/jobs";
import { getJobStatusStyle } from "../config/jobStatus";
import { getJobTypeConfig, JOB_TYPES } from "../config/jobTypes";
import { Icon } from "../components/icons";
import { JobDetailModal } from "../components/jobs/JobDetailModal";
import { ProcessingPanel } from "../components/jobs/ProcessingPanel";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Label, Select, TextInput } from "../components/ui/Field";
import { StatCard } from "../components/ui/StatCard";
import { Tabs } from "../components/ui/Tabs";

function formatRelative(iso: string | null) {
  if (!iso) return "Never run";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds === 0) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}m ${ss}s`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function ActionCard({ jobType }: { jobType: string }) {
  const config = getJobTypeConfig(jobType);
  const summary = useJobsSummary();
  const perType = summary.data?.per_type.find((t) => t.job_type === jobType);

  const startJob = useStartJob(jobType);
  const active = useActiveJob(jobType);
  const running = isJobActive(active.data?.status);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: "var(--brand-subtle)",
            color: "var(--brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "0 0 auto",
          }}
        >
          {config.icon}
        </div>
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>{config.title}</div>
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, minHeight: 36 }}>
        {config.description}
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-muted)" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Last run</span>
          <span style={{ color: "var(--text-body)" }}>{formatRelative(perType?.last_finished_at ?? null)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Status</span>
          {perType?.last_status ? (
            <Badge tone={getJobStatusStyle({ status: perType.last_status, is_interrupted: false, payload: null }).tone}>
              {getJobStatusStyle({ status: perType.last_status, is_interrupted: false, payload: null }).label}
            </Badge>
          ) : (
            <span>—</span>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Avg runtime</span>
          <span style={{ color: "var(--text-body)" }}>{formatDuration(perType?.avg_runtime_seconds ?? null)}</span>
        </div>
      </div>
      <Button
        loading={startJob.isPending}
        disabled={running}
        onClick={() => startJob.mutate(undefined)}
      >
        {running ? "Running…" : "Start Processing"}
      </Button>
    </Card>
  );
}

function ActiveJobPanel({ jobType }: { jobType: string }) {
  const active = useActiveJob(jobType);
  const [visibleId, setVisibleId] = useState<number | null>(null);

  useEffect(() => {
    if (active.data) setVisibleId(active.data.id);
    else setVisibleId(null);
  }, [active.data?.id]);

  if (!visibleId) return null;
  return <ProcessingPanel jobId={visibleId} />;
}

function HistoryTable() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"id" | "started_at" | "finished_at" | "status">("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detailId, setDetailId] = useState<number | null>(null);
  const limit = 20;

  const { data, isLoading } = useJobHistory({ status: status || undefined, search: search || undefined, sort, sortDir, limit, offset: page * limit });
  const retry = useRetryJob();
  const del = useDeleteJob();
  const bulk = useBulkJobAction();

  const jobs = data?.jobs ?? [];
  const total = data?.total ?? 0;

  function toggleSort(col: typeof sort) {
    if (sort === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(col);
      setSortDir("desc");
    }
  }

  function toggleSelected(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card padded={false} style={{ overflow: "hidden" }}>
      <div style={{ padding: 18, display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", borderBottom: "1px solid var(--border)" }}>
        <div>
          <Label>Search</Label>
          <TextInput placeholder="Job type or item…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div>
          <Label>Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="pending">Queued</option>
            <option value="running">Running</option>
            <option value="cancelling">Cancelling</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {selected.size > 0 && (
            <>
              <Button
                variant="secondary"
                size="sm"
                loading={bulk.isPending}
                onClick={() => bulk.mutate({ action: "retry", ids: [...selected] }, { onSuccess: () => setSelected(new Set()) })}
              >
                Retry Selected ({selected.size})
              </Button>
              <Button
                variant="danger"
                size="sm"
                loading={bulk.isPending}
                onClick={() => {
                  if (window.confirm(`Delete ${selected.size} job(s)?`)) {
                    bulk.mutate({ action: "delete", ids: [...selected] }, { onSuccess: () => setSelected(new Set()) });
                  }
                }}
              >
                Delete Selected
              </Button>
            </>
          )}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 960 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "36px 160px 90px 140px 140px 90px 110px 200px",
              gap: 12,
              padding: "11px 20px",
              background: "var(--surface-sunken)",
              borderBottom: "1px solid var(--border)",
              position: "sticky",
              top: 0,
              zIndex: 1,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "var(--ls-wide)",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            <span />
            <button type="button" onClick={() => toggleSort("id")} style={{ all: "unset", cursor: "pointer" }}>Job</button>
            <span>Status</span>
            <button type="button" onClick={() => toggleSort("started_at")} style={{ all: "unset", cursor: "pointer" }}>Started</button>
            <button type="button" onClick={() => toggleSort("finished_at")} style={{ all: "unset", cursor: "pointer" }}>Finished</button>
            <span>Processed</span>
            <span>Failed</span>
            <span>Actions</span>
          </div>

          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ height: 14, width: "60%", background: "var(--surface-sunken)", borderRadius: 4 }} />
              </div>
            ))}

          {!isLoading && jobs.length === 0 && (
            <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>No jobs found.</div>
          )}

          {jobs.map((job: Job) => {
            const config = getJobTypeConfig(job.job_type);
            const style = getJobStatusStyle(job);
            return (
              <div
                key={job.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "36px 160px 90px 140px 140px 90px 110px 200px",
                  alignItems: "center",
                  gap: 12,
                  padding: "var(--row-pad) 20px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 12.5,
                }}
              >
                <input type="checkbox" checked={selected.has(job.id)} onChange={() => toggleSelected(job.id)} />
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--text-strong)" }}>
                  {config.icon}
                  {config.title}
                </span>
                <Badge tone={style.tone}>{style.label}</Badge>
                <span style={{ font: "500 12px/1 var(--font-mono)", color: "var(--text-muted)" }}>{formatDateTime(job.started_at)}</span>
                <span style={{ font: "500 12px/1 var(--font-mono)", color: "var(--text-muted)" }}>{formatDateTime(job.finished_at)}</span>
                <span style={{ font: "600 12px/1 var(--font-mono)" }}>
                  {job.processed_items || job.processed_emails}/{job.total_items || job.total_emails}
                </span>
                <span style={{ font: "600 12px/1 var(--font-mono)", color: job.failed > 0 ? "var(--danger)" : "var(--text-muted)" }}>
                  {job.failed}
                </span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Button size="sm" variant="secondary" onClick={() => setDetailId(job.id)}>
                    Details
                  </Button>
                  {job.status === "failed" && (
                    <Button size="sm" variant="secondary" loading={retry.isPending} onClick={() => retry.mutate(job.id)}>
                      Retry
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Delete job #${job.id}?`)) del.mutate(job.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", fontSize: 12.5, color: "var(--text-muted)" }}>
        <span>{total} job(s) total</span>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </Button>
          <Button size="sm" variant="ghost" disabled={(page + 1) * limit >= total} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>

      {detailId !== null && <JobDetailModal jobId={detailId} onClose={() => setDetailId(null)} />}
    </Card>
  );
}

export function PipelineCenter() {
  const [tab, setTab] = useState("active");
  const summary = useJobsSummary();
  const s = summary.data;

  return (
    <>
      <div>
        <h1 style={{ margin: 0, font: "var(--fw-bold) 20px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>Pipeline Center</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>Manage and monitor all background jobs.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <StatCard icon={<Icon.spinner size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Running" value={s?.running ?? 0} />
        <StatCard icon={<Icon.clock size={17} />} iconColor="var(--text-muted)" iconBg="var(--surface-sunken)" label="Queued" value={s?.queued ?? 0} />
        <StatCard icon={<Icon.check size={17} />} iconColor="var(--success)" iconBg="var(--success-subtle)" label="Completed today" value={s?.completed_today ?? 0} valueColor="var(--success)" />
        <StatCard icon={<Icon.x size={17} />} iconColor="var(--danger)" iconBg="var(--danger-subtle)" label="Failed today" value={s?.failed_today ?? 0} valueColor="var(--danger)" />
        <StatCard icon={<Icon.mail size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Emails processed today" value={s?.emails_processed_today ?? 0} />
        <StatCard icon={<Icon.offer size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Offers generated today" value={s?.offers_generated_today ?? 0} />
        <StatCard icon={<Icon.sparkle size={17} />} iconColor="var(--ai)" iconBg="var(--ai-subtle)" label="Brands researched today" value={s?.brands_researched_today ?? 0} />
        <StatCard icon={<Icon.trendUp size={17} />} iconColor="var(--text-muted)" iconBg="var(--surface-sunken)" label="Success rate" value={`${s?.success_rate ?? 0}%`} />
      </div>

      <Card>
        <CardHeader title="Pipeline actions" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          {JOB_TYPES.map((t) => (
            <ActionCard key={t.jobType} jobType={t.jobType} />
          ))}
        </div>
      </Card>

      <Tabs
        tabs={[
          { id: "active", label: "Active Jobs" },
          { id: "history", label: "History" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "active" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {JOB_TYPES.map((t) => (
            <ActiveJobPanel key={t.jobType} jobType={t.jobType} />
          ))}
        </div>
      )}

      {tab === "history" && <HistoryTable />}
    </>
  );
}
