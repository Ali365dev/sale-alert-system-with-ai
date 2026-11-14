import { PlayIcon } from "./icons";

export function ControlsBar({ status, phase, busy, onStart, onNewSession, sendCmd }: {
  status: string;
  /** Which engine the pause/resume/stop commands target. */
  phase: "listing" | "details";
  busy: boolean;
  onStart: () => void;
  onNewSession: () => void;
  sendCmd: (msg: Record<string, unknown>, okText?: string) => void;
}) {
  const prefix = phase === "details" ? "TAKHFIF_DETAILS" : "TAKHFIF_LISTING";
  // Full literal class strings — Tailwind's JIT cannot see interpolated names.
  const ghostAmber = "flex-1 py-2.5 bg-surface border border-line hover:border-amber-500/40 text-amber-400 text-[11px] font-bold rounded-xl transition";
  const ghostRed = "flex-1 py-2.5 bg-surface border border-line hover:border-red-500/40 text-red-400 text-[11px] font-bold rounded-xl transition";
  return (
    <div className="mx-3 mb-2.5 flex gap-2">
      {status === "idle" && (
        <button
          onClick={onStart} disabled={busy}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-[11px] font-black rounded-xl transition tracking-wider"
        >
          <PlayIcon />
          {busy ? "Starting…" : "START LISTING SCRAPING"}
        </button>
      )}
      {status === "running" && (
        <>
          <button
            onClick={() => sendCmd({ type: `${prefix}_PAUSE` }, "Pausing after the current page…")}
            disabled={busy} className={ghostAmber}
          >
            Pause
          </button>
          <button
            onClick={() => sendCmd({ type: `${prefix}_STOP` }, "Stopping…")}
            disabled={busy} className={ghostRed}
          >
            Stop
          </button>
        </>
      )}
      {status === "paused" && (
        <>
          <button
            onClick={() => sendCmd({ type: `${prefix}_RESUME` }, "Resuming…")}
            disabled={busy}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-[11px] font-black rounded-xl transition"
          >
            <PlayIcon /> Resume
          </button>
          <button
            onClick={() => sendCmd({ type: `${prefix}_STOP` })}
            disabled={busy} className={ghostRed}
          >
            Stop
          </button>
        </>
      )}
      {(status === "completed" || status === "stopped" || status === "failed") && (
        <button
          onClick={onNewSession} disabled={busy}
          className="flex-1 py-2.5 bg-surface border border-primary/30 hover:border-primary text-primary text-[11px] font-bold rounded-xl transition"
        >
          Start New Session
        </button>
      )}
    </div>
  );
}
