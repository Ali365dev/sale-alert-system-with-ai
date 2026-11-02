import type { ConnectionStatus } from "../../types";

function StatusDot({ status }: { status: "connected" | "error" | "unknown" }) {
  const color =
    status === "connected" ? "bg-green-400" :
    status === "error" ? "bg-red-400" : "bg-gray-500";
  const pulse = status === "connected" ? "" : "";
  return <span className={`w-2 h-2 rounded-full inline-block flex-shrink-0 ${color} ${pulse}`} />;
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
  const statusColor = allConnected ? "text-green-400" : anyError ? "text-red-400" : "text-gray-400";

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-dark border-b border-gray-800 flex-shrink-0">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white font-black text-[10px] tracking-tight leading-none">DM</span>
        </div>
        <div>
          <p className="text-white font-black text-sm leading-tight tracking-tight">
            Deals More Scraper
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center gap-1.5"
          title={`App: ${connStatus.appServer} · Scraper: ${connStatus.scraperServer}`}
        >
          <StatusDot
            status={allConnected ? "connected" : anyError ? "error" : "unknown"}
          />
          <span className={`text-[10px] font-semibold ${statusColor}`}>{statusLabel}</span>
        </div>

        <button
          onClick={onSettingsClick}
          aria-label="Open settings"
          className="text-gray-400 hover:text-white transition p-1 rounded text-base leading-none"
        >
          ⚙
        </button>
      </div>
    </div>
  );
}
