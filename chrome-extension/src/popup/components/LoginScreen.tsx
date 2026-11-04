import { useState } from "react";
import { login } from "../../services/api";
import { getSettings, saveSettings } from "../../services/storage";

interface Props {
  onLogin: () => void;
}

export function LoginScreen({ onLogin }: Props) {
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (serverUrl.trim()) {
        await saveSettings({ appServerUrl: serverUrl.trim() });
      }
      await login(password);
      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  // Pre-fill server URL from storage
  useState(() => {
    getSettings().then((s) => setServerUrl(s.appServerUrl));
  });

  return (
    <div className="flex flex-col items-center justify-center h-full px-5 py-8 gap-6">
      {/* Logo */}
      <div className="flex flex-col items-center gap-2">
        <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-lg">
          <span className="text-white font-black text-xl">D</span>
        </div>
        <h1 className="text-lg font-black text-t1 tracking-tight">Deals More</h1>
        <p className="text-xs text-t2">Admin Sign In</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
        <div>
          <label className="block text-xs font-semibold text-t2 mb-1">
            Admin Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            required
            className="w-full px-3 py-2.5 text-sm rounded-lg border border-line bg-surface-2 text-t1 placeholder-t3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition"
          />
        </div>

        {/* Advanced settings toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="text-xs text-t3 hover:text-t1 text-left transition"
        >
          {showAdvanced ? "▲" : "▼"} Advanced settings
        </button>

        {showAdvanced && (
          <div>
            <label className="block text-xs font-semibold text-t2 mb-1">
              Server URL
            </label>
            <input
              type="url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://localhost:8000"
              className="w-full px-3 py-2 text-xs rounded-lg border border-line bg-surface-2 text-t1 placeholder-t3 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition font-mono"
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded-lg">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white text-sm font-bold rounded-lg transition shadow-sm"
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
