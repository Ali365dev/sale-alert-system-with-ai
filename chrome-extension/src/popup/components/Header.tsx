import type { ConnectionStatus } from "../../types";
import { Tooltip } from "./Tooltip";

function StatusDot({ status }: { status: "connected" | "error" | "unknown" }) {
  const color =
    status === "connected" ? "bg-green-400" :
    status === "error" ? "bg-red-400" : "bg-t3";
  return <span className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${color}`} />;
}

interface Props {
  onSettingsClick: () => void;
  connStatus: ConnectionStatus;
}

export function Header({ onSettingsClick, connStatus }: Props) {
  const allConnected =
    connStatus.appServer === "connected" && connStatus.scraperServer === "connected";
  const anyError =
    connStatus.appServer === "error" || connStatus.scraperServer === "error";

  const statusLabel = allConnected ? "Online" : anyError ? "Offline" : "Unknown";
  const statusColor = allConnected ? "text-green-400" : anyError ? "text-red-400" : "text-t2";

  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 bg-surface border-b border-line flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-black text-[11px] tracking-tight leading-none">S</span>
        </div>
        <div>
          <p className="text-white font-black text-[13px] leading-tight tracking-tight">Scraper</p>
          <p className="text-primary font-bold text-[8px] uppercase tracking-[0.12em] leading-tight">Admin</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-1.5 px-2 py-1 bg-surface-2 border border-line rounded-lg"
          title={`App: ${connStatus.appServer} · Scraper: ${connStatus.scraperServer}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            allConnected ? "bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.6)]" :
            anyError ? "bg-red-400" : "bg-t3"
          }`} />
          <span className={`text-[9px] font-bold ${statusColor}`}>{statusLabel}</span>
        </div>

        <Tooltip text="Settings" position="bottom">
          <button
            onClick={onSettingsClick}
            aria-label="Open settings"
            className="w-7 h-7 bg-surface-2 border border-line rounded-lg flex items-center justify-center text-t2 hover:text-white hover:border-t3 transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
