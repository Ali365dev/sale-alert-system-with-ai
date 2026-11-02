import { useCallback, useEffect, useState } from "react";
import type { ConnectionStatus } from "../../types";
import { getSettings, saveSettings } from "../../services/storage";
import { testConnection, logout } from "../../services/api";

interface Props {
  onLogout: () => void;
  onConnStatusChange: (status: ConnectionStatus) => void;
}

function StatusBadge({ status }: { status: "connected" | "error" | "unknown" }) {
  const cls =
    status === "connected" ? "bg-green-100 text-green-600" :
    status === "error" ? "bg-red-100 text-red-500" : "bg-gray-100 text-gray-500";
  const label =
    status === "connected" ? "● Online" :
    status === "error" ? "● Offline" : "● Unknown";
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${cls}`}>
      {label}
    </span>
  );
}

export function SettingsTab({ onLogout, onConnStatusChange }: Props) {
  const [appUrl, setAppUrl] = useState("");
  const [scraperUrl, setScraperUrl] = useState("");
  const [testing, setTesting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [connStatus, setConnStatus] = useState<ConnectionStatus>({
    appServer: "unknown",
    scraperServer: "unknown",
  });
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  useEffect(() => {
    getSettings().then((s) => {
      setAppUrl(s.appServerUrl);
      setScraperUrl(s.scraperServerUrl);
    });
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    try {
      const result = await testConnection();
      const status: ConnectionStatus = {
        appServer: result.appServer ? "connected" : "error",
        scraperServer: result.scraperServer ? "connected" : "error",
        lastChecked: new Date().toISOString(),
      };
      setConnStatus(status);
      setLastChecked(new Date().toLocaleTimeString());
      onConnStatusChange(status);
    } catch {
      const status: ConnectionStatus = { appServer: "error", scraperServer: "error" };
      setConnStatus(status);
      onConnStatusChange(status);
    } finally {
      setTesting(false);
    }
  }, [onConnStatusChange]);

  const handleSave = async () => {
    await saveSettings({
      appServerUrl: appUrl.trim(),
      scraperServerUrl: scraperUrl.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleLogout = async () => {
    await logout();
    onLogout();
  };

  return (
    <div className="scrollable px-3 py-3 flex flex-col gap-3">
      {/* Server connection */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <p className="text-xs font-bold text-dark mb-3">Server Connection</p>

        <div className="flex flex-col gap-2.5">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-semibold text-gray-500">
                App Server (port 8000)
              </label>
              <StatusBadge status={connStatus.appServer} />
            </div>
            <input
              type="url"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              placeholder="http://localhost:8000"
              className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg font-mono outline-none focus:border-primary bg-gray-50"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-semibold text-gray-500">
                Scraper Server (port 8001)
              </label>
              <StatusBadge status={connStatus.scraperServer} />
            </div>
            <input
              type="url"
              value={scraperUrl}
              onChange={(e) => setScraperUrl(e.target.value)}
              placeholder="http://localhost:8001"
              className="w-full text-xs px-2 py-1.5 border border-gray-200 rounded-lg font-mono outline-none focus:border-primary bg-gray-50"
            />
          </div>
        </div>

        {lastChecked && (
          <p className="text-[10px] text-gray-400 mt-2">Last tested: {lastChecked}</p>
        )}

        <div className="flex gap-2 mt-3">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex-1 py-2 bg-dark hover:bg-gray-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
          >
            {testing ? "Testing…" : "Test Connection"}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-xl transition"
          >
            {saved ? "Saved ✓" : "Save"}
          </button>
        </div>
      </div>

      {/* Account */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <p className="text-xs font-bold text-dark mb-2">Account</p>
        <button
          onClick={handleLogout}
          className="w-full py-2 border border-gray-200 hover:border-red-300 text-gray-600 hover:text-red-500 text-xs font-semibold rounded-xl transition"
        >
          Sign Out
        </button>
      </div>

      {/* Extension info */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <p className="text-xs font-bold text-dark mb-1.5">About</p>
        <p className="text-[10px] text-gray-500">Deals More Scraper v1.0.0</p>
        <p className="text-[10px] text-gray-400">Chrome Extension · Manifest V3</p>
      </div>

      <div className="h-1" />
    </div>
  );
}
