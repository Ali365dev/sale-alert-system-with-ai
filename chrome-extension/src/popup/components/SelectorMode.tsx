import { useState, useEffect, useRef } from "react";

interface PickedSelector {
  selector: string;
  matches: number;
  preview: string;
  tag: string;
}

interface SelectorModeProps {
  onClose: () => void;
}

export function SelectorMode({ onClose }: SelectorModeProps) {
  const [active, setActive] = useState(false);
  const [picked, setPicked] = useState<PickedSelector | null>(null);
  const [selectorName, setSelectorName] = useState("");
  const [selectorType, setSelectorType] = useState("text");
  const [saved, setSaved] = useState<Array<PickedSelector & { name: string; type: string }>>([]);
  const portRef = useRef<chrome.runtime.Port | null>(null);

  // Connect a persistent port so the background worker can push SELECTOR_PICKED back
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
        // Close the popup so user can see the page result; picker already stopped
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
    // Minimize popup so page is accessible
    window.close();
  };

  const stopPicker = () => {
    setActive(false);
    chrome.runtime.sendMessage({ type: "STOP_SELECTOR_MODE" });
  };

  const savePicked = () => {
    if (!picked || !selectorName.trim()) return;
    setSaved((s) => [...s, { ...picked, name: selectorName.trim(), type: selectorType }]);
    setPicked(null);
    setSelectorName("");
  };

  const copySelector = (selector: string) => {
    navigator.clipboard.writeText(selector).catch(() => {});
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-dark">Visual Selector</p>
          <p className="text-xs text-gray-400">Click any element on the page to capture its CSS selector.</p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close selector mode"
          className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
        >
          ×
        </button>
      </div>

      {/* Activate button */}
      {!active && !picked && (
        <button
          onClick={startPicker}
          className="w-full py-2.5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-xl transition"
        >
          🎯 Pick Element
        </button>
      )}

      {active && (
        <button
          onClick={stopPicker}
          className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-bold rounded-xl transition border border-gray-200"
        >
          Cancel Picker
        </button>
      )}

      {/* Picked result */}
      {picked && (
        <div className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500">Captured selector</span>
            <button
              onClick={() => copySelector(picked.selector)}
              aria-label="Copy selector"
              className="text-xs text-primary hover:underline"
            >
              Copy
            </button>
          </div>
          <code className="text-xs bg-white border border-gray-100 rounded px-2 py-1 break-all text-dark">
            {picked.selector}
          </code>
          <div className="flex gap-3 text-xs text-gray-400">
            <span>{picked.matches} match{picked.matches !== 1 ? "es" : ""}</span>
            <span>&lt;{picked.tag}&gt;</span>
          </div>
          {picked.preview && (
            <p className="text-xs text-gray-500 italic truncate">"{picked.preview}"</p>
          )}

          {/* Name + type + save */}
          <input
            type="text"
            placeholder="Selector name (e.g. sale_price)"
            value={selectorName}
            onChange={(e) => setSelectorName(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-primary"
          />
          <select
            value={selectorType}
            onChange={(e) => setSelectorType(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-primary"
          >
            <option value="text">Text</option>
            <option value="image">Image URL</option>
            <option value="link">Link URL</option>
            <option value="attribute">Attribute</option>
          </select>
          <div className="flex gap-2">
            <button
              onClick={savePicked}
              disabled={!selectorName.trim()}
              className="flex-1 py-1.5 bg-primary disabled:opacity-50 text-white text-xs font-bold rounded-lg transition"
            >
              Save
            </button>
            <button
              onClick={startPicker}
              className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
            >
              Pick again
            </button>
          </div>
        </div>
      )}

      {/* Saved selectors list */}
      {saved.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-semibold text-gray-500">Saved selectors</p>
          {saved.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-2 p-2 bg-white border border-gray-100 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-dark truncate">{s.name}</p>
                <p className="text-xs text-gray-400 truncate">{s.selector}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => copySelector(s.selector)}
                  aria-label={`Copy selector for ${s.name}`}
                  className="text-xs text-primary hover:underline"
                >
                  Copy
                </button>
                <button
                  onClick={() => setSaved((prev) => prev.filter((_, idx) => idx !== i))}
                  aria-label={`Remove selector ${s.name}`}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
