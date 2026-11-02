import { useState } from "react";
import { useScraperConfigs, useScraperConfig, useCreateScraperConfig, useUpdateScraperConfig, useDeleteScraperConfig, useRunScraperConfig, useCreateSelector, useDeleteSelector } from "../api/scraperConfigs";
import type { ScraperConfig, ScraperSelector, ScraperConfigInput } from "../api/scraperConfigs";
import { useBrands } from "../api/brands";
import { useToastStore } from "../store/toastStore";

const SELECTOR_TYPES = ["text", "image", "link", "price", "attribute", "html", "table", "pagination", "click", "container"] as const;

const TYPE_COLORS: Record<string, string> = {
  text: "var(--brand)",
  image: "#8b5cf6",
  link: "#0ea5e9",
  price: "#10b981",
  attribute: "#f59e0b",
  html: "#6366f1",
  table: "#ec4899",
  pagination: "#64748b",
  click: "#ef4444",
  container: "#84cc16",
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SelectorNode({
  selector,
  all,
  depth,
  configId,
  onDelete,
}: {
  selector: ScraperSelector;
  all: ScraperSelector[];
  depth: number;
  configId: number;
  onDelete: (id: number) => void;
}) {
  const children = all.filter((s) => s.parent_id === selector.id);
  const color = TYPE_COLORS[selector.selector_type] ?? "var(--text-muted)";

  return (
    <div style={{ marginLeft: depth * 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 10px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          background: "var(--surface-card)",
          marginBottom: 4,
          fontSize: 13,
        }}
      >
        {/* Tree line */}
        {depth > 0 && (
          <span style={{ color: "var(--border)", fontSize: 14, marginRight: -4 }}>└</span>
        )}
        {/* Type badge */}
        <span
          style={{
            padding: "2px 7px",
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            background: `${color}22`,
            color,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {selector.selector_type}
        </span>
        {/* Name */}
        <span style={{ fontWeight: 600, color: "var(--text-strong)", flex: 1 }}>{selector.name}</span>
        {/* CSS selector */}
        <code style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--surface)", padding: "2px 6px", borderRadius: 4, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selector.css_selector || "—"}
        </code>
        {/* Badges */}
        {selector.multiple && <span style={{ fontSize: 10, color: "var(--text-faint)" }}>multiple</span>}
        {!selector.enabled && <span style={{ fontSize: 10, color: "var(--text-faint)", fontStyle: "italic" }}>disabled</span>}
        {/* Delete */}
        <button
          onClick={() => onDelete(selector.id)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-faint)", fontSize: 14, lineHeight: 1 }}
          title="Delete selector"
        >
          ×
        </button>
      </div>

      {children.map((child) => (
        <SelectorNode
          key={child.id}
          selector={child}
          all={all}
          depth={depth + 1}
          configId={configId}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}

function AddSelectorForm({
  configId,
  selectors,
  onDone,
}: {
  configId: number;
  selectors: ScraperSelector[];
  onDone: () => void;
}) {
  const toast = useToastStore();
  const createSelector = useCreateSelector();
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("text");
  const [css, setCss] = useState("");
  const [parentId, setParentId] = useState<number | null>(null);
  const [multiple, setMultiple] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !css.trim()) { toast.error("Name and CSS selector are required"); return; }
    createSelector.mutate(
      { configId, input: { name, selector_type: type, css_selector: css, parent_id: parentId, multiple } },
      {
        onSuccess: () => { toast.success("Selector added."); onDone(); },
        onError: () => toast.error("Failed to add selector."),
      },
    );
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--surface-input)",
    color: "var(--text-strong)",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Name *</label>
          <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Product Title" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Type</label>
          <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
            {SELECTOR_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>CSS Selector *</label>
        <input style={{ ...inputStyle, fontFamily: "monospace" }} value={css} onChange={(e) => setCss(e.target.value)} placeholder=".product-card .sale-price" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Parent Selector</label>
          <select style={inputStyle} value={parentId ?? ""} onChange={(e) => setParentId(e.target.value ? parseInt(e.target.value) : null)}>
            <option value="">None (root)</option>
            {selectors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text-body)", cursor: "pointer", paddingBottom: 2 }}>
          <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
          Multiple
        </label>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={createSelector.isPending} style={{ padding: "8px 16px", background: "var(--brand)", color: "var(--on-brand)", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          {createSelector.isPending ? "Adding…" : "Add Selector"}
        </button>
        <button type="button" onClick={onDone} style={{ padding: "8px 16px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ConfigForm({
  initial,
  brands,
  onSave,
  onCancel,
}: {
  initial?: Partial<ScraperConfig>;
  brands: { id: number; name: string }[];
  onSave: (data: ScraperConfigInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brandId, setBrandId] = useState<number | null>(initial?.brand_id ?? null);
  const [startUrls, setStartUrls] = useState((initial?.start_urls ?? []).join("\n"));
  const [maxPages, setMaxPages] = useState(initial?.max_pages ?? 20);
  const [maxDepth, setMaxDepth] = useState(initial?.max_depth ?? 3);
  const [delay, setDelay] = useState(initial?.request_delay ?? 1.5);

  const inputStyle: React.CSSProperties = {
    padding: "8px 10px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--surface-input)",
    color: "var(--text-strong)",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      brand_id: brandId ?? undefined,
      start_urls: startUrls.split("\n").map((u) => u.trim()).filter(Boolean),
      max_pages: maxPages,
      max_depth: maxDepth,
      request_delay: delay,
    });
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Config Name *</label>
        <input required style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Brand</label>
        <select style={inputStyle} value={brandId ?? ""} onChange={(e) => setBrandId(e.target.value ? parseInt(e.target.value) : null)}>
          <option value="">— No brand (ad-hoc) —</option>
          {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Start URLs (one per line)</label>
        <textarea style={{ ...inputStyle, fontFamily: "monospace", minHeight: 80, resize: "vertical" }} value={startUrls} onChange={(e) => setStartUrls(e.target.value)} placeholder="https://brand.com/sale" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        {([
          ["Max Pages", maxPages, setMaxPages],
          ["Max Depth", maxDepth, setMaxDepth],
          ["Delay (s)", delay, setDelay],
        ] as [string, number, (v: number) => void][]).map(([label, val, setter]) => (
          <div key={label}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>{label}</label>
            <input type="number" step={label === "Delay (s)" ? 0.5 : 1} min={0} style={inputStyle} value={val} onChange={(e) => setter(parseFloat(e.target.value))} />
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={{ padding: "8px 18px", background: "var(--brand)", color: "var(--on-brand)", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Save
        </button>
        <button type="button" onClick={onCancel} style={{ padding: "8px 18px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ScraperBuilder() {
  const toast = useToastStore();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showAddSelector, setShowAddSelector] = useState(false);

  const { data: configsData, isLoading: configsLoading } = useScraperConfigs();
  const { data: activeConfig } = useScraperConfig(selectedId);
  const { data: brandsData } = useBrands(null);
  const createConfig = useCreateScraperConfig();
  const updateConfig = useUpdateScraperConfig();
  const deleteConfig = useDeleteScraperConfig();
  const runConfig = useRunScraperConfig();
  const deleteSelector = useDeleteSelector();

  const configs = configsData?.configs ?? [];
  const brands = brandsData?.brands ?? [];
  const selectors = activeConfig?.selectors ?? [];
  const rootSelectors = selectors.filter((s) => s.parent_id === null);

  const handleCreate = (input: ScraperConfigInput) => {
    createConfig.mutate(input, {
      onSuccess: (res) => {
        toast.success("Scraper config created.");
        setSelectedId((res.data as ScraperConfig).id);
        setShowNewForm(false);
      },
      onError: () => toast.error("Failed to create config."),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this scraper config and all its selectors?")) return;
    deleteConfig.mutate(id, {
      onSuccess: () => { toast.success("Deleted."); if (selectedId === id) setSelectedId(null); },
      onError: () => toast.error("Delete failed."),
    });
  };

  const handleRun = (id: number) => {
    runConfig.mutate(id, {
      onSuccess: () => toast.success("Scrape job started."),
      onError: () => toast.error("Failed to start job."),
    });
  };

  const handleDeleteSelector = (selectorId: number) => {
    if (!selectedId) return;
    deleteSelector.mutate(
      { configId: selectedId, selectorId },
      {
        onSuccess: () => toast.success("Selector deleted."),
        onError: () => toast.error("Failed to delete selector."),
      },
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div style={{ padding: "20px 24px 0", borderBottom: "1px solid var(--border)", paddingBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", margin: 0 }}>Visual Scraper Builder</h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              Create and manage CSS selector trees for brand websites.
            </p>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            style={{ padding: "9px 18px", background: "var(--brand)", color: "var(--on-brand)", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            + New Config
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", flex: 1, minHeight: 0 }}>
        {/* Config list */}
        <div style={{ borderRight: "1px solid var(--border)", overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {showNewForm && (
            <div style={{ marginBottom: 8, padding: 14, background: "var(--surface)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
              <ConfigForm brands={brands} onSave={handleCreate} onCancel={() => setShowNewForm(false)} />
            </div>
          )}

          {configsLoading && <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>}
          {!configsLoading && configs.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: 24 }}>No configs yet. Create one to start building.</p>
          )}

          {configs.map((c) => (
            <div
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              style={{
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${selectedId === c.id ? "var(--brand)" : "var(--border)"}`,
                background: selectedId === c.id ? "var(--brand-subtle)" : "var(--surface-card)",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: selectedId === c.id ? "var(--brand)" : "var(--text-strong)" }}>{c.name}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={(e) => { e.stopPropagation(); handleRun(c.id); }} title="Run now" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "var(--brand)" }}>▶</button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} title="Delete" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text-faint)" }}>×</button>
                </div>
              </div>
              {c.brand_id && <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "2px 0 0" }}>Brand #{c.brand_id}</p>}
              <p style={{ fontSize: 11, color: "var(--text-faint)", margin: "2px 0 0" }}>{(c.start_urls ?? []).length} URL{(c.start_urls ?? []).length !== 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>

        {/* Selector tree */}
        <div style={{ overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          {!selectedId ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "var(--text-muted)", gap: 8, paddingTop: 60 }}>
              <span style={{ fontSize: 32 }}>🌳</span>
              <p style={{ fontSize: 14, fontWeight: 600 }}>Select a config to view its selector tree</p>
            </div>
          ) : (
            <>
              {/* Config header */}
              {activeConfig && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-strong)", margin: 0 }}>{activeConfig.name}</h2>
                    <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      {activeConfig.start_urls?.join(", ") || "No start URLs"} · {selectors.length} selector{selectors.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowAddSelector(true)}
                    style={{ padding: "8px 14px", background: "var(--brand)", color: "var(--on-brand)", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                  >
                    + Add Selector
                  </button>
                </div>
              )}

              {showAddSelector && (
                <AddSelectorForm
                  configId={selectedId}
                  selectors={selectors}
                  onDone={() => setShowAddSelector(false)}
                />
              )}

              {/* Tree */}
              {selectors.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
                  <p style={{ fontSize: 14 }}>No selectors yet. Add one to build the extraction tree.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {rootSelectors.map((s) => (
                    <SelectorNode
                      key={s.id}
                      selector={s}
                      all={selectors}
                      depth={0}
                      configId={selectedId}
                      onDelete={handleDeleteSelector}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
