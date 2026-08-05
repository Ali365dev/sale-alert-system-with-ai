import { useEffect } from "react";

import { useJob, useJobFullLogs, useRetryJob, type JobLogEntry } from "../../api/jobs";
import { getJobStatusStyle, getSeverityColor, getSeverityIcon, getStageLabel } from "../../config/jobStatus";
import { getJobTypeConfig } from "../../config/jobTypes";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  const mm = Math.floor(s / 60).toString().padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
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
  const text = logs.map((l) => `[${new Date(l.time).toISOString()}] ${l.severity.toUpperCase()} ${l.category ? `(${l.category}) ` : ""}${l.message}`).join("\n");
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `job-${jobId}-logs.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function JobDetailModal({ jobId, onClose }: { jobId: number; onClose: () => void }) {
  const { data: job } = useJob(jobId);
  const fullLogs = useJobFullLogs(jobId);
  const retry = useRetryJob();

  useEffect(() => {
    fullLogs.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch full logs once when the modal opens for this job
  }, [jobId]);

  if (!job) return null;

  const config = getJobTypeConfig(job.job_type);
  const status = getJobStatusStyle(job);
  const stage = getStageLabel(job.stage);

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
          <KeyValueRow
            label="Elapsed"
            value={formatDuration(
              job.started_at ? (new Date(job.finished_at ?? Date.now()).getTime() - new Date(job.started_at).getTime()) / 1000 : null,
            )}
          />
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
            {(fullLogs.data ?? []).map((log) => (
              <div key={log.id} style={{ display: "flex", gap: 8, color: getSeverityColor(log.severity) }}>
                <span style={{ color: "var(--text-faint)", flex: "0 0 auto" }}>{new Date(log.time).toLocaleTimeString()}</span>
                <span style={{ flex: "0 0 auto" }}>{getSeverityIcon(log.severity)}</span>
                {log.category && <span style={{ color: "var(--text-faint)", flex: "0 0 auto" }}>[{log.category}]</span>}
                <span style={{ color: "var(--text-body)" }}>{log.message}</span>
              </div>
            ))}
            {(!fullLogs.data || fullLogs.data.length === 0) && (
              <span style={{ color: "var(--text-muted)" }}>{fullLogs.isFetching ? "Loading…" : "No logs yet."}</span>
            )}
          </div>
        </Section>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            size="sm"
            loading={fullLogs.isFetching}
            onClick={async () => {
              const { data } = await fullLogs.refetch();
              if (data) downloadLogs(job.id, data);
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
