import { useJob, useJobFullLogs, useRetryJob, type JobLogEntry } from "../../api/jobs";
import { getJobStatusStyle, getSeverityColor, getSeverityIcon, getStageLabel } from "../../config/jobStatus";
import { getJobTypeConfig } from "../../config/jobTypes";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

/** Backend timestamps are UTC without a Z suffix; treat them as UTC. */
function parseApiDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const normalized = iso.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatDateTime(iso: string | null) {
  const d = parseApiDate(iso);
  return d ? d.toLocaleString() : "—";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-muted)" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function KeyValueRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ color: "var(--text-strong)", fontFamily: "var(--font-mono)", textAlign: "right" }}>{value}</span>
    </div>
  );
}

function downloadLogs(jobId: number, logs: JobLogEntry[]) {
  const text = logs
    .map((l) => {
      const t = parseApiDate(l.time);
      return `[${t ? t.toISOString() : l.time}] ${l.severity.toUpperCase()} ${l.category ? `(${l.category}) ` : ""}${l.message}`;
    })
    .join("\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `job-${jobId}-logs.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function JobDetailModal({ jobId, onClose }: { jobId: number; onClose: () => void }) {
  const { data: job, isLoading: jobLoading, isError: jobError } = useJob(jobId);
  const fullLogs = useJobFullLogs(jobId);
  const retry = useRetryJob();

  if (jobLoading && !job) {
    return (
      <Modal title={`Job #${jobId}`} onClose={onClose}>
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading job details…</div>
      </Modal>
    );
  }

  if (jobError || !job) {
    return (
      <Modal title={`Job #${jobId}`} onClose={onClose}>
        <div style={{ color: "var(--danger)", fontSize: 13 }}>Could not load this job. It may have been deleted.</div>
      </Modal>
    );
  }

  const config = getJobTypeConfig(job.job_type);
  const status = getJobStatusStyle(job);
  const stage = getStageLabel(job.stage);
  const logs = fullLogs.data ?? [];
  const started = parseApiDate(job.started_at);
  const finished = parseApiDate(job.finished_at);
  const elapsedSeconds =
    started != null ? ((finished ?? new Date()).getTime() - started.getTime()) / 1000 : null;

  return (
    <Modal title={`${config.title} — Job #${job.id}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxHeight: "70vh", overflowY: "auto" }}>
        <Section title="Summary">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Badge tone={status.tone}>{status.label}</Badge>
            {stage && <Badge tone="neutral">{stage}</Badge>}
          </div>
          <KeyValueRow label="Type" value={job.job_type} />
          <KeyValueRow label="Started" value={formatDateTime(job.started_at)} />
          <KeyValueRow label="Finished" value={formatDateTime(job.finished_at)} />
          <KeyValueRow label="Processed / Total" value={`${job.processed_items || job.processed_emails} / ${job.total_items || job.total_emails}`} />
          <KeyValueRow label="Successful / Failed / Skipped" value={`${job.successful} / ${job.failed} / ${job.skipped}`} />
        </Section>

        <Section title="Performance">
          <KeyValueRow label="Elapsed" value={formatDuration(elapsedSeconds)} />
          <KeyValueRow label="Remaining (est.)" value={formatDuration(job.estimated_remaining_seconds)} />
          <KeyValueRow label="Speed" value={job.processing_speed ? `${job.processing_speed} ${config.itemNoun}/min` : "—"} />
        </Section>

        {job.error && (
          <Section title="Error">
            <div style={{ fontSize: 12.5, color: "var(--danger)", whiteSpace: "pre-wrap" }}>{job.error}</div>
            {job.is_interrupted && <div style={{ fontSize: 11.5, color: "var(--warning)" }}>Interrupted by a server restart.</div>}
          </Section>
        )}

        {job.checkpoint && (
          <Section title="Checkpoint">
            <KeyValueRow label="Last item" value={job.checkpoint.last_item_label} />
          </Section>
        )}

        {(job.payload || job.result) && (
          <Section title="Metadata">
            {job.payload && Object.keys(job.payload).length > 0 && (
              <pre style={{ margin: 0, fontSize: 11, background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 8, overflowX: "auto" }}>
                {JSON.stringify(job.payload, null, 2)}
              </pre>
            )}
            {job.result && Object.keys(job.result).length > 0 && (
              <pre style={{ margin: 0, fontSize: 11, background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 8, overflowX: "auto" }}>
                {JSON.stringify(job.result, null, 2)}
              </pre>
            )}
          </Section>
        )}

        <Section title="Timeline / Logs">
          <div
            style={{
              maxHeight: 220,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 3,
              background: "var(--surface-sunken)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 10px",
              fontFamily: "var(--font-mono)",
              fontSize: 11.5,
            }}
          >
            {logs.map((log) => (
              <div key={log.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: getSeverityColor(log.severity) }}>
                <span style={{ color: "var(--text-faint)", flex: "0 0 auto" }}>
                  {parseApiDate(log.time)?.toLocaleTimeString() ?? "—"}
                </span>
                <span style={{ flex: "0 0 auto" }}>{getSeverityIcon(log.severity)}</span>
                {log.category && <span style={{ color: "var(--text-faint)", flex: "0 0 auto" }}>[{log.category}]</span>}
                <span style={{ color: "var(--text-body)", whiteSpace: "pre-line" }}>{log.message}</span>
              </div>
            ))}
            {logs.length === 0 && (
              <span style={{ color: "var(--text-muted)" }}>
                {fullLogs.isFetching || fullLogs.isLoading ? "Loading…" : fullLogs.isError ? "Failed to load logs." : "No logs yet."}
              </span>
            )}
          </div>
        </Section>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            size="sm"
            loading={fullLogs.isFetching}
            disabled={logs.length === 0 && !fullLogs.isFetching}
            onClick={async () => {
              const { data } = await fullLogs.refetch();
              if (data && data.length > 0) downloadLogs(job.id, data);
            }}
          >
            Download logs
          </Button>
          {job.status === "failed" && (
            <Button variant="secondary" size="sm" loading={retry.isPending} onClick={() => retry.mutate(job.id)}>
              Retry
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
