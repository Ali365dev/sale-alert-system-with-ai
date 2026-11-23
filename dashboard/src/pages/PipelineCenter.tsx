import { useState } from "react";

import {
  isJobActive,
  useActiveJob,
  useActiveJobsList,
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
import { JobDetailModal } from "../components/jobs/JobDetailModal";
import { ActiveJobsList } from "../components/jobs/ActiveJobsList";
import { Icon } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button, IconButton } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { DataTable, DataTableBody, DataTableCheckbox, DataTableEmpty, DataTableHead, DataTableRow, SortHeader } from "../components/ui/DataTable";
import { Label, Select, TextInput } from "../components/ui/Field";
import { StatCard } from "../components/ui/StatCard";
import { Tabs } from "../components/ui/Tabs";

/** Backend timestamps are UTC without a Z suffix; treat them as UTC. */
function parseApiDate(iso: string | null): Date | null {
  if (!iso) return null;
  const normalized = iso.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatRelative(iso: string | null) {
  const d = parseApiDate(iso);
  if (!d) return "Never run";
  const diffMs = Date.now() - d.getTime();
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
  const d = parseApiDate(iso);
  if (!d) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
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

function HistoryTable() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"id" | "started_at" | "finished_at" | "status">("id");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [detailId, setDetailId] = useState<number | null>(null);
  const limit = 20;

  const { data, isLoading, isFetching, isError } = useJobHistory({
    status: status || undefined,
    search: search || undefined,
    sort,
    sortDir,
    limit,
    offset: page * limit,
  });
  const retry = useRetryJob();
  const del = useDeleteJob();
  const bulk = useBulkJobAction();

  const jobs = data?.jobs ?? [];
  const total = data?.total ?? 0;

  function toggleSort(col: typeof sort) {
    setPage(0);
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
          <TextInput
            placeholder="Job type or item…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <div>
          <Label>Status</Label>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
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

      <DataTable
        label="Scraping jobs"
        columns="24px minmax(200px, 1fr) 112px 152px 152px 88px 72px 120px"
        minWidth={980}
        align={{ 5: "right", 6: "right" }}
        stickyActions
      >
        <DataTableHead>
          <DataTableCheckbox
            label="Select all jobs on this page"
            checked={jobs.length > 0 && jobs.every((j: Job) => selected.has(j.id))}
            indeterminate={selected.size > 0}
            onChange={(checked) => setSelected(checked ? new Set(jobs.map((j: Job) => j.id)) : new Set())}
          />
          <SortHeader label="Job" direction={sort === "id" ? sortDir : null} onSort={() => toggleSort("id")} />
          <SortHeader label="Status" direction={sort === "status" ? sortDir : null} onSort={() => toggleSort("status")} />
          <SortHeader label="Started" direction={sort === "started_at" ? sortDir : null} onSort={() => toggleSort("started_at")} />
          <SortHeader label="Finished" direction={sort === "finished_at" ? sortDir : null} onSort={() => toggleSort("finished_at")} />
          <span>Processed</span>
          <span>Failed</span>
          <span>Actions</span>
        </DataTableHead>
        <DataTableBody>
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <DataTableRow key={i}>
                <span />
                <div className="skeleton-shimmer" style={{ height: 12, width: "70%" }} />
              </DataTableRow>
            ))}
          {!isLoading && isError && <DataTableEmpty>Job history couldn't load. Check that the scraper server is running</DataTableEmpty>}
          {!isLoading && !isError && jobs.length === 0 && <DataTableEmpty>No jobs yet</DataTableEmpty>}
          {jobs.map((job: Job) => {
            const config = getJobTypeConfig(job.job_type);
            const style = getJobStatusStyle(job);
            const jobTotal = job.total_items || job.total_emails;
            return (
              <DataTableRow key={job.id} selected={selected.has(job.id)}>
                <DataTableCheckbox label={`Select job ${job.id}`} checked={selected.has(job.id)} onChange={() => toggleSelected(job.id)} />
                <span className="dt-strong" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span className="dt-muted" style={{ display: "inline-flex" }} aria-hidden="true">{config.icon}</span>
                  <span className="dt-truncate">{config.title}</span>
                  <span className="dt-id">#{job.id}</span>
                </span>
                <Badge tone={style.tone}>{style.label}</Badge>
                <span className="dt-date dt-muted">{formatDateTime(job.started_at)}</span>
                <span className="dt-date dt-muted">{formatDateTime(job.finished_at)}</span>
                <span className="dt-num">
                  {(job.processed_items || job.processed_emails).toLocaleString()}
                  <span className="dt-faint"> / {jobTotal.toLocaleString()}</span>
                </span>
                <span className={job.failed > 0 ? "dt-num" : "dt-num dt-faint"} style={job.failed > 0 ? { color: "var(--danger)" } : undefined}>
                  {job.failed}
                </span>
                <span style={{ display: "flex", gap: 4 }}>
                  <IconButton icon={<Icon.eye size={14} />} label="Job details" variant="ghost" onClick={() => setDetailId(job.id)} />
                  {job.status === "failed" && (
                    <IconButton icon={<Icon.retry size={14} />} label="Retry job" variant="ghost" loading={retry.isPending} onClick={() => retry.mutate(job.id)} />
                  )}
                  <IconButton
                    icon={<Icon.trash size={14} />}
                    label="Delete job"
                    variant="danger"
                    onClick={() => {
                      if (window.confirm(`Delete job #${job.id}?`)) del.mutate(job.id);
                    }}
                  />
                </span>
              </DataTableRow>
            );
          })}
        </DataTableBody>
      </DataTable>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", fontSize: 12.5, color: "var(--text-muted)" }}>
        <span>
          {total} {total === 1 ? "job" : "jobs"}{isFetching && !isLoading ? " · updating…" : ""}
        </span>
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
  const activeCount = useActiveJobsList().data?.total ?? 0;

  return (
    <>
      <div>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>Manage and monitor all background jobs.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <StatCard label="Running" value={s?.running ?? 0} />
        <StatCard label="Queued" value={s?.queued ?? 0} />
        <StatCard label="Completed today" value={s?.completed_today ?? 0} valueColor="var(--success)" />
        <StatCard label="Failed today" value={s?.failed_today ?? 0} valueColor="var(--danger)" />
        <StatCard label="Emails processed today" value={s?.emails_processed_today ?? 0} />
        <StatCard label="Offers generated today" value={s?.offers_generated_today ?? 0} />
        <StatCard label="Brands researched today" value={s?.brands_researched_today ?? 0} />
        <StatCard label="Success rate" value={`${s?.success_rate ?? 0}%`} />
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
          { id: "active", label: activeCount ? `Active Jobs (${activeCount})` : "Active Jobs" },
          { id: "history", label: "History" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "active" && <ActiveJobsList />}

      {tab === "history" && <HistoryTable />}
    </>
  );
}
