import type { Job, JobStatus } from "../api/jobs";

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "ai" | "brand";

interface StatusStyle {
  label: string;
  tone: BadgeTone;
}

/** Real, stored statuses. "Retrying"/"Interrupted" are derived labels (see
 * getJobStatusStyle) rather than additional stored statuses — keeps the
 * backend status enum small while still giving every state its own badge. */
const STATUS_STYLE: Record<JobStatus, StatusStyle> = {
  pending: { label: "Queued", tone: "neutral" },
  running: { label: "Running", tone: "brand" },
  cancelling: { label: "Cancelling…", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  completed: { label: "Completed", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

export function getJobStatusStyle(job: Pick<Job, "status" | "is_interrupted" | "payload">): StatusStyle {
  if (job.is_interrupted) {
    return { label: "Interrupted", tone: "warning" };
  }
  if (job.payload?.retry_of && (job.status === "pending" || job.status === "running")) {
    return { label: "Retrying", tone: "ai" };
  }
  return STATUS_STYLE[job.status] ?? { label: job.status, tone: "neutral" };
}

const STAGE_LABELS: Record<string, string> = {
  connecting: "Connecting",
  collecting_work: "Collecting work",
  fetching: "Fetching",
  processing: "Processing",
  ai_analysis: "AI analysis",
  reading_email: "Reading email",
  generating_offer: "Generating offer",
  saving_data: "Saving data",
  saving: "Saving",
  researching_brand: "Researching brand",
  verifying_offer: "Verifying offer",
  finalizing: "Finalizing",
  completed: "Completed",
};

export function getStageLabel(stage: string | null): string | null {
  if (!stage) return null;
  return STAGE_LABELS[stage] ?? stage;
}

const SEVERITY_ICON: Record<string, string> = {
  success: "✓",
  warning: "⚠",
  error: "✖",
  info: "•",
};

export function getSeverityIcon(severity: string): string {
  return SEVERITY_ICON[severity] ?? "•";
}

const SEVERITY_COLOR: Record<string, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  error: "var(--danger)",
  info: "var(--text-muted)",
};

export function getSeverityColor(severity: string): string {
  return SEVERITY_COLOR[severity] ?? "var(--text-muted)";
}
