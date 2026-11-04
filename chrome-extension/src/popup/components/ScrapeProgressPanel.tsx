import type { ScrapeProgress } from "../../types";

interface Props {
  progress: ScrapeProgress;
  onStop: () => void;
}

const STAT_LABELS = [
  { key: "pagesVisited" as const, label: "Pages" },
  { key: "offersDetected" as const, label: "Detected" },
  { key: "offersProcessed" as const, label: "Processed" },
  { key: "offersSaved" as const, label: "Saved" },
];

export function ScrapeProgressPanel({ progress, onStop }: Props) {
  return (
    <div className="mx-3 mt-2 bg-surface rounded-xl border border-line p-3 shimmer-panel">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-bold text-t1 truncate flex-1 mr-2">{progress.operation}</p>
        <button
          onClick={onStop}
          className="flex-shrink-0 text-[10px] px-2.5 py-1 rounded-lg font-bold transition"
          style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.18)", color: "#f87171" }}
        >
          Stop
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-surface-2 rounded-full overflow-hidden mb-1">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <div className="flex justify-between mb-3">
        <span className="text-[10px] text-t2">Extracting offers…</span>
        <span className="text-[10px] font-bold text-primary">{Math.round(progress.percent)}%</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {STAT_LABELS.map(({ key, label }) => (
          <div key={key} className="bg-surface-2 rounded-lg p-1.5 text-center border border-line">
            <p className="text-sm font-black text-t1 leading-tight">{progress[key]}</p>
            <p className="text-[9px] text-t2 leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
