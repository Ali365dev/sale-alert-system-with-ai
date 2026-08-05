import { useEffect, useRef, useState } from "react";

import { useAuditLog, useExportSettings, useImportSettings, useSystemSettings, useUpdateSystemSettings, type SystemSettings } from "../../api/settings";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { FieldGroup, Label, Select } from "../ui/Field";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function AuditLogSection() {
  const [page, setPage] = useState(0);
  const limit = 20;
  const { data, isLoading } = useAuditLog(limit, page * limit);

  return (
    <Card>
      <CardHeader title="Audit Log" />
      {isLoading ? (
        <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {(data?.entries ?? []).map((e) => (
            <div key={e.id} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
              <span style={{ color: "var(--text-faint)", flex: "0 0 150px", fontFamily: "var(--font-mono)" }}>{formatDate(e.created_at)}</span>
              <Badge tone="neutral">{e.action}</Badge>
              <span style={{ color: "var(--text-muted)" }}>
                {e.entity_type}
                {e.entity_id ? `:${e.entity_id}` : ""}
              </span>
            </div>
          ))}
          {(data?.entries.length ?? 0) === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No changes recorded yet.</div>}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-muted)" }}>
        <span>{data?.total ?? 0} entries total</span>
        <div style={{ display: "flex", gap: 8 }}>
          <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            Previous
          </Button>
          <Button size="sm" variant="ghost" disabled={((page + 1) * limit) >= (data?.total ?? 0)} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}

function ImportExportSection() {
  const exportSettings = useExportSettings();
  const importSettings = useImportSettings();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function download() {
    exportSettings.mutate(undefined, {
      onSuccess: (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `settings-export-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text);
        importSettings.mutate(parsed);
      } catch {
        alert("That file isn't valid JSON.");
      }
    });
    e.target.value = "";
  }

  return (
    <Card>
      <CardHeader title="Import & Export" />
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
        Exports prompts and settings as JSON. API keys are never included — re-add them manually after import.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="secondary" loading={exportSettings.isPending} onClick={download}>
          Export JSON
        </Button>
        <Button variant="secondary" loading={importSettings.isPending} onClick={() => fileInputRef.current?.click()}>
          Import JSON
        </Button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={upload} style={{ display: "none" }} />
      </div>
    </Card>
  );
}

export function SystemTab() {
  const { data, isLoading } = useSystemSettings();
  const update = useUpdateSystemSettings();
  const [form, setForm] = useState<SystemSettings | null>(null);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (isLoading || !form) return <div style={{ color: "var(--text-muted)" }}>Loading…</div>;

  const dirty = JSON.stringify(form) !== JSON.stringify(data);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    <Card>
      <CardHeader title="System" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
        <FieldGroup>
          <Label>Timezone</Label>
          <Select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Asia/Karachi">Asia/Karachi</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
          </Select>
        </FieldGroup>
        <FieldGroup>
          <Label>Date format</Label>
          <Select value={form.date_format} onChange={(e) => setForm({ ...form, date_format: e.target.value })}>
            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
          </Select>
        </FieldGroup>
        <FieldGroup>
          <Label>Theme</Label>
          <Select value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </Select>
        </FieldGroup>
        <FieldGroup>
          <Label>Logging level</Label>
          <Select value={form.log_level} onChange={(e) => setForm({ ...form, log_level: e.target.value })}>
            <option value="DEBUG">Debug</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
          </Select>
        </FieldGroup>
      </div>
      <div>
        <Button loading={update.isPending} disabled={!dirty} onClick={() => update.mutate(form)}>
          Save changes
        </Button>
      </div>
    </Card>
    <ImportExportSection />
    <AuditLogSection />
    </div>
  );
}
