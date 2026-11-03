import type { TabScrapeState } from "../../types";
import { Tooltip } from "./Tooltip";

interface Props {
  state: TabScrapeState;
  onCancel: () => void;
}

export function TabScrapePanel({ state, onCancel }: Props) {
  const pct = state.totalCount > 0
    ? Math.round((state.doneCount / state.totalCount) * 100)
    : 0;

  return (
    <div className="mx-3 mt-2 bg-white border border-gray-200 rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse flex-shrink-0" />
          <p className="text-[10px] font-bold text-dark truncate">
            Browser Scraping — {state.currentBrand || "starting…"}
          </p>
        </div>
        <Tooltip text="Stop browser tab scraping" position="left">
          <button
            onClick={onCancel}
            aria-label="Cancel browser scrape"
            className="flex-shrink-0 ml-2 text-[10px] text-red-400 hover:text-red-600 font-bold"
          >
            ✕ Cancel
          </button>
        </Tooltip>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${Math.max(pct, 3)}%` }}
        />
      </div>

      {/* Current URL */}
      {state.currentUrl && (
        <p className="text-[10px] text-gray-400 truncate mb-1.5">{state.currentUrl}</p>
      )}

      {/* Stats */}
      <div className="flex gap-3 text-[10px] text-gray-400">
        <span>{state.doneCount}/{state.totalCount} brands</span>
        {state.offersFound > 0 && (
          <span className="text-green-500 font-semibold">{state.offersFound} offers found</span>
        )}
      </div>
    </div>
  );
}
