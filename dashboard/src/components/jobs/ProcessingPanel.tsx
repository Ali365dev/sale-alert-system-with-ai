import { useEffect, useRef, useState } from "react";

import { useCancelJob, useJob, useJobLogs, useRetryJob, type Job } from "../../api/jobs";
import { getJobStatusStyle, getSeverityColor, getSeverityIcon, getStageLabel } from "../../config/jobStatus";
import { getJobTypeConfig } from "../../config/jobTypes";
import { Icon } from "../icons";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { JobDetailModal } from "./JobDetailModal";

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

/** Brief colored flash on the card border when the job's status just changed
 * — a lightweight "something happened" cue without a new animation library. */
function useTransitionFlash(status: string | undefined) {
  const [flash, setFlash] = useState<string | null>(null);
  const prev = useRef(status);

  useEffect(() => {
    if (prev.current !== status && status && ["completed", "failed", "cancelled"].includes(status)) {
      setFlash(status);
      const t = setTimeout(() => setFlash(null), 1600);
      prev.current = status;
      return () => clearTimeout(t);
    }
    prev.current = status;
  }, [status]);

  return flash;
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

const FLASH_COLOR: Record<string, string> = {
  completed: "var(--success)",
  failed: "var(--danger)",
  cancelled: "var(--text-muted)",
};

export function ProcessingPanel({ jobId, onDismiss }: { jobId: number; onDismiss?: () => void }) {
  const { data: job } = useJob(jobId);
  const active = job?.status === "pending" || job?.status === "running" || job?.status === "cancelling";
  const { data: logs } = useJobLogs(jobId, active);
  const cancel = useCancelJob(jobId);
  const retry = useRetryJob();
  const elapsed = useElapsedSeconds(job);
  const flash = useTransitionFlash(job?.status);
  const [detailsOpen, setDetailsOpen] = useState(false);

  if (!job) return null;

  const config = getJobTypeConfig(job.job_type);
  const status = getJobStatusStyle(job);
  const stage = getStageLabel(job.stage);
  const pct = Math.min(100, Math.max(0, job.progress_percentage));
  const processed = job.processed_items || job.processed_emails;
  const total = job.total_items || job.total_emails;
  const currentItem = job.current_item_label || job.current_email_subject;

  return (
    <>
      <Card
        style={{
          borderColor: flash ? FLASH_COLOR[flash] : undefined,
          boxShadow: flash ? `0 0 0 1px ${FLASH_COLOR[flash]}` : undefined,
          transition: "border-color 0.3s ease, box-shadow 0.3s ease",
        }}
      >
        <CardHeader
          icon={
            active ? (
              <span style={{ display: "inline-flex", animation: "processing-spin 1s linear infinite" }}>
                <Icon.spinner size={17} style={{ color: "var(--brand)" }} />
              </span>
            ) : (
              config.icon
            )
          }
          title={config.title}
          aside={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge tone={status.tone}>{status.label}</Badge>
              <Button variant="ghost" size="sm" onClick={() => setDetailsOpen(true)}>
                View Details
              </Button>
              {active && (
                <Button
                  variant="danger"
                  size="sm"
                  loading={cancel.isPending || job.cancel_requested}
                  onClick={() => cancel.mutate()}
                >
                  {job.status === "cancelling" ? "Cancelling…" : "Cancel"}
                </Button>
              )}
              {job.status === "failed" && (
                <Button variant="secondary" size="sm" loading={retry.isPending} onClick={() => retry.mutate(job.id)}>
                  Retry
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

        {stage && (
          <div style={{ fontSize: 11.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "var(--ls-wide)" }}>
            {stage}
          </div>
        )}

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
              {processed} / {total} {config.itemNoun}
            </span>
            <span style={{ font: "600 12.5px/1 var(--font-mono)", color: "var(--text-strong)" }}>{pct}%</span>
          </div>
        </div>

        {job.status === "cancelling" && (
          <div style={{ fontSize: 12.5, color: "var(--warning)" }}>
            Finishing {currentItem ? `"${currentItem}"` : "the current item"} before stopping — this can take a few
            seconds while its request completes.
          </div>
        )}

        {currentItem && active && job.status !== "cancelling" && (
          <div style={{ fontSize: 12.5, color: "var(--text-body)" }}>
            <strong style={{ color: "var(--text-strong)" }}>Current:</strong> "{currentItem}"
          </div>
        )}

        {job.error && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>Error: {job.error}</div>}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <StatBox label="Success" value={job.successful} color="var(--success)" />
          <StatBox label="Failed" value={job.failed} color="var(--danger)" />
          <StatBox label="Skipped" value={job.skipped} color="var(--text-muted)" />
          <StatBox label="Elapsed" value={formatDuration(elapsed)} />
          <StatBox label="Remaining" value={active ? formatDuration(job.estimated_remaining_seconds) : "—"} />
          <StatBox label="Speed" value={job.processing_speed ? `${job.processing_speed}/min` : "—"} />
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
              <div key={log.id} style={{ display: "flex", gap: 8, alignItems: "flex-start", color: getSeverityColor(log.severity) }}>
                <span style={{ color: "var(--text-faint)", flex: "0 0 auto" }}>
                  {new Date(log.time).toLocaleTimeString()}
                </span>
                <span style={{ flex: "0 0 auto" }}>{getSeverityIcon(log.severity)}</span>
                <span style={{ color: "var(--text-body)", whiteSpace: "pre-line" }}>{log.message}</span>
              </div>
            ))}
          </div>
        )}

        <style>{`
          @keyframes processing-shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
          @keyframes processing-spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </Card>

      {detailsOpen && <JobDetailModal jobId={jobId} onClose={() => setDetailsOpen(false)} />}
    </>
  );
}
