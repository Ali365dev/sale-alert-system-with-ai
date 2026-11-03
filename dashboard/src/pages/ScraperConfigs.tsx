import { useState } from "react";
import { useNavigate } from "react-router";
import { useScraperConfigs, useDeleteScraperConfig, useRunScraperConfig, useUpdateScraperConfig } from "../api/scraperConfigs";
import { useBrands } from "../api/brands";
import { toast } from "../store/toastStore";

export function ScraperConfigs() {
  const navigate = useNavigate();
  const [brandFilter, setBrandFilter] = useState<number | undefined>(undefined);

  const { data, isLoading } = useScraperConfigs(brandFilter);
  const { data: brandsData } = useBrands(null);
  const deleteConfig = useDeleteScraperConfig();
  const runConfig = useRunScraperConfig();
  const updateConfig = useUpdateScraperConfig();

  const configs = data?.configs ?? [];
  const brands = brandsData?.brands ?? [];
  const brandMap = Object.fromEntries(brands.map((b) => [b.id, b.name]));

  const handleDelete = (id: number) => {
    if (!confirm("Delete this scraper config?")) return;
    deleteConfig.mutate(id, {
      onSuccess: () => toast.success("Config deleted."),
      onError: () => toast.error("Delete failed."),
    });
  };

  const handleRun = (id: number) => {
    runConfig.mutate(id, {
      onSuccess: () => toast.success("Scrape job started."),
      onError: () => toast.error("Failed to start job."),
    });
  };

  const handleToggle = (id: number, current: boolean) => {
    updateConfig.mutate({ id, input: { enabled: !current } }, {
      onSuccess: () => toast.success(current ? "Config disabled." : "Config enabled."),
    });
  };

  const selectStyle: React.CSSProperties = {
    padding: "8px 12px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--surface-input)",
    color: "var(--text-strong)",
    fontSize: 13,
  };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", margin: 0 }}>Scraper Configs</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Manage custom CSS selector configs for brand websites.</p>
        </div>
        <button
          onClick={() => navigate("/scraper-builder")}
          style={{ padding: "9px 18px", background: "var(--brand)", color: "var(--on-brand)", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          + New Config
        </button>
      </div>

      {/* Brand filter */}
      <select style={selectStyle} value={brandFilter ?? ""} onChange={(e) => setBrandFilter(e.target.value ? parseInt(e.target.value) : undefined)}>
        <option value="">All brands</option>
        {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      {isLoading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}
      {!isLoading && configs.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <p style={{ fontSize: 32, margin: 0 }}>🔧</p>
          <p style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>No scraper configs yet</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Use the Visual Scraper Builder to create your first config.</p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
        {configs.map((c) => (
          <div
            key={c.id}
            style={{
              padding: 16,
              background: "var(--surface-card)",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border)",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              opacity: c.enabled ? 1 : 0.65,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>{c.name}</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                  {c.brand_id ? brandMap[c.brand_id] ?? `Brand #${c.brand_id}` : "No brand"}
                </p>
              </div>
              <span style={{
                padding: "2px 8px",
                borderRadius: 100,
                fontSize: 11,
                fontWeight: 700,
                background: c.enabled ? "var(--success-subtle, #d1fae5)" : "var(--surface)",
                color: c.enabled ? "var(--success, #059669)" : "var(--text-faint)",
              }}>
                {c.enabled ? "Active" : "Disabled"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 12, fontSize: 12, color: "var(--text-muted)" }}>
              <span>{(c.start_urls ?? []).length} URL{(c.start_urls ?? []).length !== 1 ? "s" : ""}</span>
              <span>Max {c.max_pages} pages</span>
              <span>Depth {c.max_depth}</span>
              <span>{c.request_delay}s delay</span>
            </div>

            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => navigate(`/scraper-builder?config=${c.id}`)} style={{ flex: 1, padding: "6px", background: "var(--surface)", color: "var(--text-body)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Edit
              </button>
              <button onClick={() => handleRun(c.id)} style={{ flex: 1, padding: "6px", background: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-subtle-2)", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Run
              </button>
              <button onClick={() => handleToggle(c.id, c.enabled)} style={{ padding: "6px 10px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12, cursor: "pointer" }}>
                {c.enabled ? "Disable" : "Enable"}
              </button>
              <button onClick={() => handleDelete(c.id)} style={{ padding: "6px 10px", background: "transparent", color: "var(--danger)", border: "1px solid var(--danger-subtle)", borderRadius: "var(--radius-sm)", fontSize: 12, cursor: "pointer" }}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
