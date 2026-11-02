import { useEffect, useRef, useState } from "react";
import { getOrCreateScraperConfig, saveScraperSelector } from "../../services/brandsApi";

interface PickedSelector {
  selector: string;
  matches: number;
  preview: string;
  tag: string;
}

interface SavedSelector extends PickedSelector {
  name: string;
  type: string;
  savedToBackend?: boolean;
}

const SELECTOR_TYPES = ["text", "price", "image", "link", "attribute"] as const;

interface Props {
  pageUrl: string;
}

export function SelectorsTab({ pageUrl }: Props) {
  const [active, setActive] = useState(false);
  const [picked, setPicked] = useState<PickedSelector | null>(null);
  const [selectorName, setSelectorName] = useState("");
  const [selectorType, setSelectorType] = useState("text");
  const [saved, setSaved] = useState<SavedSelector[]>([]);
  const [saving, setSaving] = useState(false);
  const [domain, setDomain] = useState("");
  const portRef = useRef<chrome.runtime.Port | null>(null);

  useEffect(() => {
    if (pageUrl) {
      try { setDomain(new URL(pageUrl).hostname.replace("www.", "")); } catch { setDomain(""); }
    }
  }, [pageUrl]);

  useEffect(() => {
    const port = chrome.runtime.connect({ name: "popup" });
    portRef.current = port;
    port.onMessage.addListener((msg: { type: string } & Record<string, unknown>) => {
      if (msg.type === "SELECTOR_PICKED") {
        setPicked({
          selector: msg.selector as string,
          matches: msg.matches as number,
          preview: msg.preview as string,
          tag: msg.tag as string,
        });
        setActive(false);
      } else if (msg.type === "SELECTOR_MODE_CANCELLED") {
        setActive(false);
      }
    });
    return () => port.disconnect();
  }, []);

  const startPicker = () => {
    setPicked(null);
    setActive(true);
    chrome.runtime.sendMessage({ type: "START_SELECTOR_MODE" });
    window.close();
  };

  const stopPicker = () => {
    setActive(false);
    chrome.runtime.sendMessage({ type: "STOP_SELECTOR_MODE" });
  };

  const savePicked = async () => {
    if (!picked || !selectorName.trim()) return;
    const entry: SavedSelector = { ...picked, name: selectorName.trim(), type: selectorType };
    setSaving(true);
    try {
      const configId = await getOrCreateScraperConfig(null, domain || "unknown");
      await saveScraperSelector(configId, {
        name: entry.name,
        selector_type: entry.type,
        css_selector: entry.selector,
        multiple: entry.matches > 1,
      });
      entry.savedToBackend = true;
    } catch {
      // save locally even if backend fails
    } finally {
      setSaving(false);
    }
    setSaved((s) => [...s, entry]);
    setPicked(null);
    setSelectorName("");
  };

  const copy = (text: string) => navigator.clipboard.writeText(text).catch(() => {});

  return (
    <div className="scrollable px-3 py-3 flex flex-col gap-3">
      {domain && (
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <span>🌐</span>
          <span className="truncate">{domain}</span>
        </div>
      )}

      {/* Picker panel */}
      <div className="bg-white rounded-xl border border-gray-200 p-3">
        <p className="text-xs font-bold text-dark mb-0.5">Visual Element Picker</p>
        <p className="text-[10px] text-gray-400 mb-3">
          Click any element on the page to capture its CSS selector.
        </p>

        {!active && !picked && (
          <button
            onClick={startPicker}
            className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white text-xs font-bold rounded-xl transition"
          >
            🎯 Activate Picker
          </button>
        )}

        {active && (
          <button
            onClick={stopPicker}
            className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition border border-gray-200"
          >
            ✕ Cancel Picker
          </button>
        )}

        {picked && (
          <div className="flex flex-col gap-2">
            <div className="bg-gray-50 rounded-lg p-2 border border-gray-100">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-semibold text-gray-500">Captured Selector</span>
                <button onClick={() => copy(picked.selector)} className="text-[10px] text-primary hover:underline font-semibold">
                  Copy
                </button>
              </div>
              <code className="text-[10px] bg-white border border-gray-100 rounded px-2 py-1 break-all text-dark block font-mono">
                {picked.selector}
              </code>
              <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                <span>{picked.matches} match{picked.matches !== 1 ? "es" : ""}</span>
                <span>&lt;{picked.tag}&gt;</span>
                {picked.preview && (
                  <span className="italic truncate flex-1">"{picked.preview}"</span>
                )}
              </div>
            </div>

            <input
              type="text"
              placeholder="Name (e.g. sale_price)"
              value={selectorName}
              onChange={(e) => setSelectorName(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary bg-gray-50"
            />

            <select
              value={selectorType}
              onChange={(e) => setSelectorType(e.target.value)}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary bg-gray-50"
            >
              {SELECTOR_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={savePicked}
                disabled={!selectorName.trim() || saving}
                className="flex-1 py-2 bg-primary disabled:opacity-50 text-white text-xs font-bold rounded-xl transition"
              >
                {saving ? "Saving…" : "Save Selector"}
              </button>
              <button
                onClick={startPicker}
                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl transition"
              >
                Pick Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Saved selectors */}
      {saved.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="text-2xl mb-1">📌</span>
          <p className="text-xs font-semibold text-gray-500">No saved selectors</p>
          <p className="text-[10px] text-gray-400 mt-1">Activate the picker and save a selector above.</p>
        </div>
      ) : (
        <div>
          <p className="text-xs font-bold text-dark mb-2">Saved ({saved.length})</p>
          <div className="flex flex-col gap-1.5">
            {saved.map((s, i) => (
              <div key={i} className="flex items-center gap-2.5 p-2.5 bg-white border border-gray-200 rounded-xl">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <p className="text-xs font-semibold text-dark">{s.name}</p>
                    <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md">{s.type}</span>
                    {s.savedToBackend && (
                      <span className="text-[9px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded-md">saved</span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-400 truncate font-mono">{s.selector}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => copy(s.selector)} aria-label={`Copy ${s.name}`}
                    className="text-[10px] text-primary hover:underline font-semibold">Copy</button>
                  <button onClick={() => setSaved((p) => p.filter((_, idx) => idx !== i))}
                    aria-label={`Remove ${s.name}`}
                    className="text-[10px] text-red-400 hover:text-red-600 font-bold">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="h-1" />
    </div>
  );
}
