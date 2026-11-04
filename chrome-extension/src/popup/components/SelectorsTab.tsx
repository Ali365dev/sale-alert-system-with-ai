import { useEffect, useRef, useState } from "react";
import type {
  ListingConfig, PaginationConfig, PaginationMethod,
  ExtractedProduct, SimilarSelectorResult,
} from "../../types";
import { getOrCreateScraperConfig, saveListingConfig } from "../../services/brandsApi";

// ── types ──────────────────────────────────────────────────────────────────────

interface PickTarget {
  fieldKey: string;
  label: string;
}

interface PickedMeta {
  selector: string;
  matches: number;
  similar: SimilarSelectorResult | null;
  tag: string;
}

// ── field definitions ──────────────────────────────────────────────────────────

const LISTING_FIELDS: { key: keyof ListingConfig["fields"]; label: string; attr: string; placeholder: string }[] = [
  { key: "title",         label: "Product Title",    attr: "text", placeholder: "h2.product-name, .title…" },
  { key: "url",           label: "Product URL",      attr: "href", placeholder: "a.product-link…" },
  { key: "image",         label: "Product Image",    attr: "src",  placeholder: "img.product-img…" },
  { key: "currentPrice",  label: "Current Price",    attr: "text", placeholder: ".price, span.sale-price…" },
  { key: "originalPrice", label: "Original Price",   attr: "text", placeholder: ".old-price, del…" },
  { key: "discount",      label: "Discount",         attr: "text", placeholder: ".badge-discount…" },
  { key: "availability",  label: "Availability",     attr: "text", placeholder: ".stock-status…" },
  { key: "sku",           label: "SKU",              attr: "text", placeholder: ".sku, [data-sku]…" },
];

const PAGINATION_METHODS: { value: PaginationMethod; label: string; icon: string }[] = [
  { value: "none",            label: "No Pagination",   icon: "—" },
  { value: "next-button",     label: "Next Button",     icon: "›" },
  { value: "load-more",       label: "Load More",       icon: "↓" },
  { value: "url-pattern",     label: "URL Pattern",     icon: "#" },
  { value: "infinite-scroll", label: "Infinite Scroll", icon: "∞" },
];

// ── default config ─────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: ListingConfig = {
  containerSelector: "",
  fields: {},
  pagination: { method: "none", maxPages: 10 },
};

// ── CountBadge ─────────────────────────────────────────────────────────────────

function CountBadge({ selector }: { selector: string }) {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!selector) { setCount(null); return; }
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const tab = tabs.find((t) => t.url && !t.url.startsWith("chrome-extension://"));
      if (!tab?.id) return;
      chrome.tabs.sendMessage(tab.id, { type: "COUNT_SELECTOR", selector }, (res) => {
        if (!chrome.runtime.lastError && res) setCount(res.count ?? null);
      });
    });
  }, [selector]);
  if (count === null) return null;
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
      count > 0
        ? "bg-green-500/10 text-green-400 border-green-500/25"
        : "bg-red-500/10 text-red-400 border-red-500/25"
    }`}>
      {count}
    </span>
  );
}

// ── CrossIcon ──────────────────────────────────────────────────────────────────

function CrossIcon() {
  return (
    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

// ── ScopeIcon ──────────────────────────────────────────────────────────────────

function ScopeIcon({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
      <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
    </svg>
  );
}

// ── FieldRow ───────────────────────────────────────────────────────────────────

function FieldRow({
  label, cssValue, placeholder, onCssChange, onPick, onClear,
}: {
  label: string;
  cssValue: string;
  placeholder: string;
  onCssChange: (v: string) => void;
  onPick: () => void;
  onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold text-t2 uppercase tracking-wider">{label}</span>
        {cssValue && <CountBadge selector={cssValue} />}
      </div>
      <div className="flex gap-1.5 items-center">
        <input
          type="text"
          value={cssValue}
          onChange={(e) => onCssChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 font-mono outline-none focus:border-primary"
        />
        <button
          onClick={onPick}
          title={`Pick ${label}`}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition text-[10px] font-bold"
        >
          <ScopeIcon size={10} />
          Pick
        </button>
        {cssValue && (
          <button onClick={onClear} aria-label={`Clear ${label}`}
            className="flex-shrink-0 w-7 h-8 flex items-center justify-center text-t3 hover:text-red-400 transition rounded-lg hover:bg-red-500/10">
            <CrossIcon />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  pageUrl: string;
}

export function SelectorsTab({ pageUrl }: Props) {
  const [config, setConfig] = useState<ListingConfig>(DEFAULT_CONFIG);
  const [pickTarget, setPickTarget] = useState<PickTarget | null>(null);
  const pickTargetRef = useRef<PickTarget | null>(null);
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);
  const portRef = useRef<chrome.runtime.Port | null>(null);

  const [preview, setPreview] = useState<ExtractedProduct[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const domain = pageUrl ? (() => { try { return new URL(pageUrl).hostname.replace("www.", ""); } catch { return ""; } })() : "";

  const applyPickedMessage = (
    msg: { selector?: string; similar?: SimilarSelectorResult | null },
    target: PickTarget,
  ) => {
    const selector = msg.selector ?? "";
    const similar = msg.similar ?? null;

    if (target.fieldKey === "container") {
      const useSel = similar?.containerSelector || selector;
      setConfig((c) => ({ ...c, containerSelector: useSel }));
    } else if (target.fieldKey === "_pagination") {
      setConfig((c) => ({ ...c, pagination: { ...c.pagination, nextSelector: selector } }));
    } else {
      const cfg = configRef.current;
      const useSel = (similar && cfg.containerSelector) ? similar.fieldSelector : selector;
      const fieldDef = LISTING_FIELDS.find((f) => f.key === target.fieldKey as keyof ListingConfig["fields"]);
      setConfig((c) => ({
        ...c,
        fields: {
          ...c.fields,
          [target.fieldKey]: { css: useSel, attr: fieldDef?.attr },
        },
      }));
    }
  };

  // Connect port for live selector-picked events
  useEffect(() => {
    const port = chrome.runtime.connect({ name: "popup" });
    portRef.current = port;
    port.onMessage.addListener((msg: { type: string } & Record<string, unknown>) => {
      if (msg.type === "SELECTOR_PICKED") {
        const target = pickTargetRef.current;
        if (!target) return;
        applyPickedMessage(
          msg as { selector?: string; similar?: SimilarSelectorResult | null },
          target,
        );
        pickTargetRef.current = null;
        setPickTarget(null);
        chrome.storage.local.remove(["dm_pending_selector", "dm_picker_context"]);
      } else if (msg.type === "SELECTOR_MODE_CANCELLED") {
        pickTargetRef.current = null;
        setPickTarget(null);
        chrome.storage.local.remove(["dm_picker_context"]);
      }
    });

    return () => port.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startPick = (fieldKey: string, label: string) => {
    const t = { fieldKey, label };
    pickTargetRef.current = t;
    setPickTarget(t);
    // Save context so we can recover after popup re-opens
    chrome.storage.local.set({ dm_picker_context: { source: "selectors", fieldKey, label } });
    chrome.runtime.sendMessage({ type: "START_SELECTOR_MODE" });
  };

  const cancelPick = () => {
    chrome.runtime.sendMessage({ type: "STOP_SELECTOR_MODE" });
    chrome.storage.local.remove(["dm_picker_context"]);
    pickTargetRef.current = null;
    setPickTarget(null);
  };

  const setField = (key: keyof ListingConfig["fields"], css: string) => {
    const existing = config.fields[key];
    setConfig((c) => ({
      ...c,
      fields: { ...c.fields, [key]: { ...existing, css } },
    }));
  };

  const clearField = (key: keyof ListingConfig["fields"]) => {
    setConfig((c) => { const fields = { ...c.fields }; delete fields[key]; return { ...c, fields }; });
  };

  const setPagination = (patch: Partial<PaginationConfig>) => {
    setConfig((c) => ({ ...c, pagination: { ...c.pagination, ...patch } }));
  };

  const runPreview = () => {
    if (!config.containerSelector) return;
    setPreviewLoading(true);
    setPreviewError("");
    chrome.runtime.sendMessage({ type: "EXTRACT_LISTING", config }, (res) => {
      setPreviewLoading(false);
      if (chrome.runtime.lastError || !res) {
        setPreviewError("Could not connect to page. Make sure the page is loaded.");
        return;
      }
      if (res.error) { setPreviewError(res.error); return; }
      setPreview((res.products as ExtractedProduct[]) ?? []);
    });
  };

  const handleSave = async () => {
    if (!config.containerSelector) return;
    setSaving(true); setSaveMsg("");
    try {
      await saveListingConfig(config);
      setSaveMsg("Saved!");
      setTimeout(() => setSaveMsg(""), 2500);
    } catch (e) {
      setSaveMsg("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const hasFields = Object.values(config.fields).some((f) => f?.css);
  const pag = config.pagination;

  return (
    <div className="flex flex-col flex-1 min-h-0 relative">
      {/* Picker active banner */}
      {pickTarget && (
        <div className="mx-3 mt-2 flex items-center gap-2.5 px-3 py-2.5 bg-primary/10 border border-primary/30 rounded-xl flex-shrink-0">
          <span className="relative flex-shrink-0 w-2.5 h-2.5">
            <span className="absolute inset-0 rounded-full bg-primary animate-ping opacity-75" />
            <span className="relative block w-2.5 h-2.5 rounded-full bg-primary" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black text-primary uppercase tracking-wide">Picker Active</p>
            <p className="text-[10px] text-t2 truncate">Click element → <span className="font-bold text-t1">{pickTarget.label}</span></p>
          </div>
          <button
            onClick={cancelPick}
            className="flex-shrink-0 px-2.5 py-1.5 bg-surface-2 border border-line rounded-lg text-[10px] font-bold text-t2 hover:text-red-400 hover:border-red-500/30 transition"
          >
            Stop
          </button>
        </div>
      )}

      <div className="scrollable">
        {/* Header */}
        <div className="px-3 pt-3 pb-2 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-xs font-black text-t1 uppercase tracking-[0.08em]">Listing Config</p>
            {domain && <p className="text-[10px] text-t2 mt-0.5">{domain}</p>}
          </div>
          <div className="flex items-center gap-2">
            {saveMsg && <span className="text-[10px] text-green-400 font-bold">{saveMsg}</span>}
            <button
              onClick={handleSave}
              disabled={saving || !config.containerSelector}
              className="px-3 py-1.5 bg-primary hover:bg-primary-dark disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-wide rounded-lg transition"
            >
              {saving ? "Saving…" : "Save Config"}
            </button>
          </div>
        </div>

        {/* Step 1 — Product Container */}
        <div className="mx-3 mb-2.5 bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-line flex items-center gap-2">
            <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded">Step 1</span>
            <span className="text-[10px] font-bold text-t1 uppercase tracking-wide">Product Container</span>
            {config.containerSelector && <CountBadge selector={config.containerSelector} />}
          </div>
          <div className="p-3">
            <div className="flex gap-1.5 items-center">
              <input
                type="text"
                value={config.containerSelector}
                onChange={(e) => setConfig((c) => ({ ...c, containerSelector: e.target.value }))}
                placeholder=".product-card, div.item, article.product…"
                className="flex-1 min-w-0 text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 font-mono outline-none focus:border-primary"
              />
              <button
                onClick={() => startPick("container", "Product Container")}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition text-[10px] font-bold"
              >
                <ScopeIcon size={10} />
                Pick
              </button>
              {config.containerSelector && (
                <button onClick={() => setConfig((c) => ({ ...c, containerSelector: "" }))}
                  aria-label="Clear container"
                  className="flex-shrink-0 w-8 h-9 flex items-center justify-center text-t3 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition">
                  <CrossIcon />
                </button>
              )}
            </div>
            <p className="text-[10px] text-t3 mt-2">
              Click one product card — the extension auto-detects all similar cards.
            </p>
          </div>
        </div>

        {/* Step 2 — Field Selectors */}
        {config.containerSelector && (
          <div className="mx-3 mb-2.5 bg-surface border border-line rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-line flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded">Step 2</span>
                <span className="text-[10px] font-bold text-t1 uppercase tracking-wide">Field Selectors</span>
              </div>
              <span className="text-[9px] text-t3 italic">relative to container</span>
            </div>
            <div className="p-3 flex flex-col gap-3">
              {LISTING_FIELDS.map((f) => (
                <FieldRow
                  key={f.key}
                  label={f.label}
                  cssValue={config.fields[f.key]?.css ?? ""}
                  placeholder={f.placeholder}
                  onCssChange={(v) => setField(f.key, v)}
                  onPick={() => startPick(f.key, f.label)}
                  onClear={() => clearField(f.key)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 3 — Pagination */}
        <div className="mx-3 mb-2.5 bg-surface border border-line rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-line flex items-center gap-2">
            {config.containerSelector && (
              <span className="text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-1.5 py-0.5 rounded">Step 3</span>
            )}
            <span className="text-[10px] font-bold text-t1 uppercase tracking-wide">Pagination</span>
          </div>
          <div className="p-3 flex flex-col gap-3">
            {/* Method pills */}
            <div className="flex gap-1.5 flex-wrap">
              {PAGINATION_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPagination({ method: m.value })}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold transition ${
                    pag.method === m.value
                      ? "bg-primary border-primary text-white"
                      : "bg-surface-2 border-line text-t2 hover:border-t2 hover:text-t1"
                  }`}
                >
                  <span className="font-mono text-[11px]">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>

            {/* Next / Load More selector */}
            {(pag.method === "next-button" || pag.method === "load-more") && (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-t2 uppercase tracking-wider">
                    {pag.method === "next-button" ? "Next Button Selector" : "Load More Selector"}
                  </span>
                  {pag.nextSelector && <CountBadge selector={pag.nextSelector} />}
                </div>
                <div className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    value={pag.nextSelector ?? ""}
                    onChange={(e) => setPagination({ nextSelector: e.target.value || undefined })}
                    placeholder=".pagination .next, a[rel=next]…"
                    className="flex-1 min-w-0 text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 font-mono outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => startPick("_pagination", pag.method === "next-button" ? "Next Button" : "Load More Button")}
                    className="flex-shrink-0 flex items-center gap-1 px-2.5 py-2 bg-primary hover:bg-primary-dark text-white rounded-lg transition text-[10px] font-bold"
                  >
                    <ScopeIcon size={10} />
                    Pick
                  </button>
                </div>
              </div>
            )}

            {/* URL pattern */}
            {pag.method === "url-pattern" && (
              <div className="flex flex-col gap-2.5">
                <div>
                  <label className="text-[10px] font-semibold text-t2 uppercase tracking-wider block mb-1.5">
                    URL Pattern
                  </label>
                  <input
                    type="text"
                    value={pag.urlPattern ?? ""}
                    onChange={(e) => setPagination({ urlPattern: e.target.value || undefined })}
                    placeholder="https://example.com/products?page={page}"
                    className="w-full text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 placeholder-t3 font-mono outline-none focus:border-primary"
                  />
                  <p className="text-[9.5px] text-t3 mt-1">Use {"{page}"} as the page number placeholder.</p>
                </div>
                <div className="flex gap-3">
                  <div>
                    <label className="text-[10px] font-semibold text-t2 uppercase tracking-wider block mb-1">Start</label>
                    <input type="number" min={1} value={pag.urlStartPage ?? 1}
                      onChange={(e) => setPagination({ urlStartPage: +e.target.value })}
                      className="w-16 text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-t2 uppercase tracking-wider block mb-1">End</label>
                    <input type="number" min={1} value={pag.urlEndPage ?? 10}
                      onChange={(e) => setPagination({ urlEndPage: +e.target.value })}
                      className="w-16 text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 outline-none focus:border-primary" />
                  </div>
                </div>
              </div>
            )}

            {/* Max pages + Delay */}
            {pag.method !== "none" && (
              <div className="flex items-center gap-4 pt-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-t2 uppercase tracking-wider">Max Pages</span>
                  <input type="number" min={1} max={100} value={pag.maxPages ?? 10}
                    onChange={(e) => setPagination({ maxPages: +e.target.value })}
                    className="w-16 text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 outline-none focus:border-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold text-t2 uppercase tracking-wider">Delay ms</span>
                  <input type="number" min={0} step={100} value={pag.pageLoadDelay ?? 1500}
                    onChange={(e) => setPagination({ pageLoadDelay: +e.target.value })}
                    className="w-20 text-[11px] px-2.5 py-2 border border-line rounded-lg bg-surface-2 text-t1 outline-none focus:border-primary" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Extraction Preview */}
        {config.containerSelector && (
          <div className="mx-3 mb-2.5 bg-surface border border-line rounded-xl overflow-hidden">
            <div className="px-3 py-2 border-b border-line flex items-center justify-between">
              <span className="text-[10px] font-bold text-t1 uppercase tracking-wide">Extraction Preview</span>
              <button
                onClick={runPreview}
                disabled={previewLoading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 text-t1 text-[10px] font-semibold rounded-lg border border-line transition"
              >
                {previewLoading ? (
                  <span className="w-3 h-3 border border-t-transparent border-t2 rounded-full animate-spin" />
                ) : (
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                )}
                {previewLoading ? "Extracting…" : "Run Preview"}
              </button>
            </div>

            {previewError && (
              <div className="px-3 py-3 text-[10px] text-red-400">{previewError}</div>
            )}

            {!previewError && preview.length === 0 && !previewLoading && (
              <div className="px-3 py-4 text-[10px] text-t3 text-center">
                Click "Run Preview" to test your selectors on the current page.
              </div>
            )}

            {preview.length > 0 && (
              <div className="p-3">
                <p className="text-[10px] text-t2 mb-2">
                  <span className="font-bold text-green-400">{preview.length}</span> products found
                </p>
                <div className="flex flex-col gap-2 max-h-52 overflow-y-auto">
                  {preview.slice(0, 8).map((p, i) => (
                    <div key={i} className="bg-surface-2 rounded-lg p-2.5 flex gap-2.5 items-start">
                      {p.image && (
                        <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 bg-surface-3" />
                      )}
                      <div className="min-w-0 flex-1">
                        {p.title && <p className="text-[10px] font-semibold text-t1 truncate">{p.title}</p>}
                        <div className="flex gap-2 mt-1 flex-wrap">
                          {p.currentPrice && (
                            <span className="text-[9.5px] text-green-400 font-bold">{p.currentPrice}</span>
                          )}
                          {p.originalPrice && (
                            <span className="text-[9.5px] text-t3 line-through">{p.originalPrice}</span>
                          )}
                          {p.discount && (
                            <span className="text-[9.5px] text-primary font-bold">{p.discount}</span>
                          )}
                        </div>
                        {p.url && (
                          <p className="text-[9px] text-t3 truncate mt-0.5">{p.url}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {preview.length > 8 && (
                    <p className="text-[9.5px] text-t3 text-center py-1">+{preview.length - 8} more</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
}
