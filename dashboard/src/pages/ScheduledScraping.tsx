import { useState } from "react";
import { useSchedules, useCreateSchedule, useUpdateSchedule, useDeleteSchedule, useRunScheduleNow } from "../api/schedules";
import type { ScrapingSchedule, ScheduleInput } from "../api/schedules";
import { useBrands } from "../api/brands";
import { toast } from "../store/toastStore";

const PRESETS = [
  { label: "Every 6 hours", cron: "0 */6 * * *" },
  { label: "Every 12 hours", cron: "0 */12 * * *" },
  { label: "Daily at 2am", cron: "0 2 * * *" },
  { label: "Daily at 6am", cron: "0 6 * * *" },
  { label: "Weekly (Mon 8am)", cron: "0 8 * * 1" },
];

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString();
}

function ScheduleForm({
  brands,
  initial,
  onSave,
  onCancel,
}: {
  brands: { id: number; name: string }[];
  initial?: Partial<ScrapingSchedule>;
  onSave: (data: ScheduleInput) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [brandId, setBrandId] = useState<number | null>(initial?.brand_id ?? null);
  const [cron, setCron] = useState(initial?.cron_expr ?? "0 */6 * * *");
  const [timezone, setTimezone] = useState(initial?.timezone ?? "UTC");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);

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
    <form
      onSubmit={(e) => { e.preventDefault(); onSave({ name, brand_id: brandId ?? undefined, cron_expr: cron, timezone, enabled }); }}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Schedule Name *</label>
          <input required style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Adidas Daily Scrape" />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Brand *</label>
          <select required style={inputStyle} value={brandId ?? ""} onChange={(e) => setBrandId(parseInt(e.target.value))}>
            <option value="">— Select brand —</option>
            {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>Cron Expression</label>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          {PRESETS.map((p) => (
            <button
              key={p.cron}
              type="button"
              onClick={() => setCron(p.cron)}
              style={{
                padding: "4px 10px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${cron === p.cron ? "var(--brand)" : "var(--border)"}`,
                background: cron === p.cron ? "var(--brand-subtle)" : "transparent",
                color: cron === p.cron ? "var(--brand)" : "var(--text-body)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input style={{ ...inputStyle, fontFamily: "monospace" }} value={cron} onChange={(e) => setCron(e.target.value)} placeholder="0 */6 * * *" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>Timezone</label>
          <input style={inputStyle} value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC" />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text-body)", cursor: "pointer", paddingBottom: 2 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled
        </label>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" style={{ padding: "8px 18px", background: "var(--brand)", color: "var(--on-brand)", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Save Schedule
        </button>
        <button type="button" onClick={onCancel} style={{ padding: "8px 18px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ScheduledScraping() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: schedulesData, isLoading } = useSchedules();
  const { data: brandsData } = useBrands(null);
  const createSchedule = useCreateSchedule();
  const updateSchedule = useUpdateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const runNow = useRunScheduleNow();

  const schedules = schedulesData?.schedules ?? [];
  const brands = brandsData?.brands ?? [];
  const brandMap = Object.fromEntries(brands.map((b) => [b.id, b.name]));

  const handleCreate = (input: ScheduleInput) => {
    createSchedule.mutate(input, {
      onSuccess: () => { toast.success("Schedule created."); setShowForm(false); },
      onError: () => toast.error("Failed to create schedule."),
    });
  };

  const handleUpdate = (id: number, input: ScheduleInput) => {
    updateSchedule.mutate({ id, input }, {
      onSuccess: () => { toast.success("Schedule updated."); setEditingId(null); },
      onError: () => toast.error("Update failed."),
    });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this schedule?")) return;
    deleteSchedule.mutate(id, {
      onSuccess: () => toast.success("Deleted."),
      onError: () => toast.error("Delete failed."),
    });
  };

  const handleRunNow = (id: number) => {
    runNow.mutate(id, {
      onSuccess: () => toast.success("Scrape started."),
      onError: () => toast.error("Failed to start scrape."),
    });
  };

  const toggleEnabled = (s: ScrapingSchedule) => {
    updateSchedule.mutate(
      { id: s.id, input: { enabled: !s.enabled } },
      { onSuccess: () => toast.success(s.enabled ? "Schedule disabled." : "Schedule enabled.") },
    );
  };

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", margin: 0 }}>Scheduled Scraping</h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
            Automate brand website scraping on a cron schedule.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{ padding: "9px 18px", background: "var(--brand)", color: "var(--on-brand)", border: "none", borderRadius: "var(--radius-sm)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          + New Schedule
        </button>
      </div>

      {/* New schedule form */}
      {showForm && (
        <div style={{ padding: 20, background: "var(--surface-card)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "var(--text-strong)" }}>New Schedule</h3>
          <ScheduleForm brands={brands} onSave={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {/* Schedule list */}
      {isLoading && <p style={{ color: "var(--text-muted)" }}>Loading…</p>}
      {!isLoading && schedules.length === 0 && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
          <p style={{ fontSize: 32, margin: 0 }}>⏰</p>
          <p style={{ fontSize: 14, fontWeight: 600, marginTop: 8 }}>No schedules configured</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Create a schedule to automate brand scraping.</p>
        </div>
      )}

      {schedules.map((s) => (
        <div
          key={s.id}
          style={{
            padding: "16px 20px",
            background: "var(--surface-card)",
            borderRadius: "var(--radius)",
            border: `1px solid ${s.enabled ? "var(--border)" : "var(--border-faint)"}`,
            opacity: s.enabled ? 1 : 0.65,
          }}
        >
          {editingId === s.id ? (
            <>
              <ScheduleForm
                brands={brands}
                initial={s}
                onSave={(input) => handleUpdate(s.id, input)}
                onCancel={() => setEditingId(null)}
              />
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              {/* Toggle */}
              <button
                onClick={() => toggleEnabled(s)}
                style={{
                  width: 36,
                  height: 20,
                  borderRadius: 10,
                  border: "none",
                  background: s.enabled ? "var(--brand)" : "var(--border)",
                  cursor: "pointer",
                  position: "relative",
                  flexShrink: 0,
                  marginTop: 2,
                }}
                title={s.enabled ? "Disable" : "Enable"}
              >
                <span style={{
                  position: "absolute",
                  top: 2,
                  left: s.enabled ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "white",
                  transition: "left 0.15s",
                }} />
              </button>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{brandMap[s.brand_id] ?? `Brand #${s.brand_id}`}</span>
                </div>
                <code style={{ fontSize: 12, color: "var(--brand)", background: "var(--brand-subtle)", padding: "2px 8px", borderRadius: 4 }}>{s.cron_expr}</code>
                <div style={{ display: "flex", gap: 20, marginTop: 8, fontSize: 12, color: "var(--text-muted)" }}>
                  <span>Last run: {fmtDate(s.last_run_at)}</span>
                  <span>Next run: {fmtDate(s.next_run_at)}</span>
                  <span>TZ: {s.timezone}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button onClick={() => handleRunNow(s.id)} style={{ padding: "6px 12px", background: "var(--brand-subtle)", color: "var(--brand)", border: "1px solid var(--brand-subtle-2)", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Run Now
                </button>
                <button onClick={() => setEditingId(s.id)} style={{ padding: "6px 12px", background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Edit
                </button>
                <button onClick={() => handleDelete(s.id)} style={{ padding: "6px 12px", background: "transparent", color: "var(--danger)", border: "1px solid var(--danger-subtle)", borderRadius: "var(--radius-sm)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
