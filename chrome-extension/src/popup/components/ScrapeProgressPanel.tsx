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
    <div className="mx-3 mt-2 bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2.5">
        <p className="text-xs font-bold text-dark truncate flex-1 mr-2">{progress.operation}</p>
        <button
          onClick={onStop}
          className="flex-shrink-0 text-[10px] px-2 py-1 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg font-bold transition"
        >
          Stop
        </button>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      <div className="flex justify-between mb-3">
        <span className="text-[10px] text-gray-400">Extracting offers…</span>
        <span className="text-[10px] font-bold text-primary">{Math.round(progress.percent)}%</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-1.5">
        {STAT_LABELS.map(({ key, label }) => (
          <div key={key} className="bg-gray-50 rounded-lg p-1.5 text-center border border-gray-100">
            <p className="text-sm font-black text-dark leading-tight">{progress[key]}</p>
            <p className="text-[9px] text-gray-400 leading-tight mt-0.5">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
