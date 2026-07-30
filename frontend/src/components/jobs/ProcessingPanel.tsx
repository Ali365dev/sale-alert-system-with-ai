import { useEffect, useState } from "react";

import { useCancelJob, useJob, useJobLogs, type Job, type JobStatus } from "../../api/jobs";
import { Icon } from "../icons";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";

const STATUS_TONE: Record<JobStatus, "success" | "warning" | "danger" | "neutral" | "brand"> = {
  pending: "neutral",
  running: "brand",
  completed: "success",
  cancelled: "warning",
  failed: "danger",
};

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: "Pending",
  running: "Running",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
};

function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, Math.round(seconds));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function useElapsedSeconds(job: Job | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!job || job.status !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [job?.status]);

  if (!job?.started_at) return null;
  const end = job.finished_at ? new Date(job.finished_at).getTime() : now;
  return (end - new Date(job.started_at).getTime()) / 1000;
}

function StatBox({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "10px 14px",
        background: "var(--surface-sunken)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        minWidth: 84,
      }}
    >
      <span style={{ font: "600 18px/1.1 var(--font-mono)", color: color ?? "var(--text-strong)" }}>{value}</span>
      <span style={{ fontSize: 10.5, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

export function ProcessingPanel({ jobId, onDismiss }: { jobId: number; onDismiss?: () => void }) {
  const { data: job } = useJob(jobId);
  const active = job?.status === "pending" || job?.status === "running";
  const { data: logs } = useJobLogs(jobId, active);
  const cancel = useCancelJob(jobId);
  const elapsed = useElapsedSeconds(job);

  if (!job) return null;

  const pct = Math.min(100, Math.max(0, job.progress_percentage));

  return (
    <Card>
      <CardHeader
        icon={<Icon.activity size={17} style={{ color: "var(--brand)" }} />}
        title="Email Analysis"
        aside={
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Badge tone={STATUS_TONE[job.status]}>{STATUS_LABEL[job.status]}</Badge>
            {active && (
              <Button
                variant="danger"
                size="sm"
                loading={cancel.isPending || job.cancel_requested}
                onClick={() => cancel.mutate()}
              >
                {job.cancel_requested ? "Cancelling…" : "Cancel"}
              </Button>
            )}
            {!active && onDismiss && (
              <Button variant="ghost" size="sm" onClick={onDismiss}>
                Dismiss
              </Button>
            )}
          </div>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div
          style={{
            height: 10,
            borderRadius: "var(--radius-pill)",
            background: "var(--surface-sunken)",
            border: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              borderRadius: "var(--radius-pill)",
              background: job.status === "failed" ? "var(--danger)" : "var(--brand)",
              transition: "width 0.4s ease",
              backgroundImage:
                job.status === "running"
                  ? "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)"
                  : undefined,
              backgroundSize: job.status === "running" ? "200% 100%" : undefined,
              animation: job.status === "running" ? "processing-shimmer 1.4s linear infinite" : undefined,
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "var(--text-muted)" }}>
          <span>
            {job.processed_emails} / {job.total_emails} emails
          </span>
          <span style={{ font: "600 12.5px/1 var(--font-mono)", color: "var(--text-strong)" }}>{pct}%</span>
        </div>
      </div>

      {job.current_email_subject && active && (
        <div style={{ fontSize: 12.5, color: "var(--text-body)" }}>
          <strong style={{ color: "var(--text-strong)" }}>Current:</strong> "{job.current_email_subject}"
        </div>
      )}

      {job.error && (
        <div style={{ fontSize: 12.5, color: "var(--danger)" }}>Error: {job.error}</div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <StatBox label="Success" value={job.successful} color="var(--success)" />
        <StatBox label="Failed" value={job.failed} color="var(--danger)" />
        <StatBox label="Skipped" value={job.skipped} color="var(--text-muted)" />
        <StatBox label="Elapsed" value={formatDuration(elapsed)} />
        <StatBox label="Remaining" value={active ? formatDuration(job.estimated_remaining_seconds) : "—"} />
      </div>

      {logs && logs.length > 0 && (
        <div
          style={{
            maxHeight: 180,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column-reverse",
            gap: 2,
            background: "var(--surface-sunken)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 10px",
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
          }}
        >
          {[...logs].reverse().map((log) => (
            <div key={log.id} style={{ display: "flex", gap: 8, color: "var(--text-muted)" }}>
              <span style={{ color: "var(--text-faint)", flex: "0 0 auto" }}>
                {new Date(log.time).toLocaleTimeString()}
              </span>
              <span>{log.message}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes processing-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </Card>
  );
}
