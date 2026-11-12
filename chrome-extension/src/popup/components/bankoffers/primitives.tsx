import type { ReactNode } from "react";

export function Toggle({ on, onChange, label, description, badge }: {
  on: boolean; onChange: (v: boolean) => void;
  label: string; description?: string; badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-t1">{label}</span>
          {badge && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">
              {badge}
            </span>
          )}
        </div>
        {description && <p className="text-[10px] text-t2 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!on)}
        role="switch"
        aria-checked={on}
        aria-label={label}
        className={`flex-shrink-0 relative w-10 h-5 rounded-full transition-colors duration-200 ${on ? "bg-primary" : "bg-surface-3"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 ${on ? "left-5" : "left-0.5"}`} />
      </button>
    </div>
  );
}

export type PhaseStatus =
  | "ready" | "running" | "done" | "waiting" | "failed" | "skipped" | "paused" | "stopped" | "queued";

const STATUS_CLASSES: Record<PhaseStatus, string> = {
  ready:   "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  queued:  "bg-blue-500/10 text-blue-400 border border-blue-500/20",
  running: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  done:    "bg-green-500/10 text-green-400 border border-green-500/20",
  waiting: "bg-surface-3 text-t3 border border-line",
  failed:  "bg-red-500/10 text-red-400 border border-red-500/20",
  skipped: "bg-surface-3 text-t3 border border-line",
  paused:  "bg-orange-500/10 text-orange-400 border border-orange-500/20",
  stopped: "bg-surface-3 text-t3 border border-line",
};

const STATUS_LABELS: Record<PhaseStatus, string> = {
  ready: "Ready", queued: "Queue Ready", running: "Running", done: "Completed",
  waiting: "Waiting", failed: "Failed", skipped: "Skipped", paused: "Paused", stopped: "Stopped",
};

export function PhaseCard({ phase, title, description, status, progressPct, leftStat, rightStat, label, disabled }: {
  phase: string; title: string; description: string;
  status: PhaseStatus; progressPct: number;
  leftStat: string; rightStat: string;
  label?: string; disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="p-3 rounded-xl bg-surface border border-line opacity-60">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-black text-t2 uppercase tracking-wider">{phase} · {title}</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-surface-3 text-t3 border border-line">Skipped</span>
        </div>
        <p className="text-[10px] text-t3">Deal details scraping is disabled.</p>
      </div>
    );
  }

  return (
    <div className={`p-3 rounded-xl bg-surface border border-line ${status === "running" ? "shimmer-panel" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="min-w-0">
          <span className="text-[10px] font-black text-t1 uppercase tracking-wider">{phase} · {title}</span>
          {label && <p className="text-[10px] text-t2 mt-0.5 truncate">{label}</p>}
        </div>
        <span className={`flex-shrink-0 text-[9px] px-1.5 py-0.5 rounded font-bold ${STATUS_CLASSES[status]}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-t2 mb-2 mt-1">
        <span>{leftStat}</span>
        <span>{rightStat}</span>
      </div>
      <div className="h-1 bg-surface-2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${status === "failed" ? "bg-red-500" : "bg-primary"}`}
          style={{ width: `${Math.min(100, Math.max(status === "running" ? 4 : 0, progressPct))}%` }}
        />
      </div>
      {description && <p className="text-[9px] text-t3 mt-1.5">{description}</p>}
    </div>
  );
}

export function StatCard({ icon, label, value, faded }: {
  icon: ReactNode; label: string; value: string | number; faded?: boolean;
}) {
  return (
    <div className={`bg-surface border border-line rounded-xl p-3 flex flex-col gap-1 ${faded ? "opacity-50" : ""}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-t2">{label}</span>
        <span className="text-t3">{icon}</span>
      </div>
      <span className="text-xl font-black text-t1">{value}</span>
    </div>
  );
}
