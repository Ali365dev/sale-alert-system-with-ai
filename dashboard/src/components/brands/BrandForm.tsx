import { useState } from "react";

import type { Brand, BrandInput } from "../../api/brands";
import { Button } from "../ui/Button";
import { Label, TextArea, TextInput } from "../ui/Field";

export function BrandForm({
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  initial?: Brand;
  onSubmit: (input: BrandInput) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    website: initial?.website ?? "",
    logo_url: initial?.logo_url ?? "",
    categories: initial?.categories.join(", ") ?? "",
    emails: initial?.emails.join("\n") ?? "",
    is_active: initial?.is_active ?? true,
  });

  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    const emails = [...new Set(form.emails.replace(/\n/g, ",").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean))].sort();
    onSubmit({
      name: form.name.trim(),
      website: form.website.trim() || null,
      logo_url: form.logo_url.trim() || null,
      categories: form.categories.split(",").map((c) => c.trim()).filter(Boolean),
      emails,
      is_active: form.is_active,
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <Label>Brand name *</Label>
          <TextInput value={form.name} onChange={(e) => update({ name: e.target.value })} />
        </div>
        <div>
          <Label>Website URL</Label>
          <TextInput value={form.website} onChange={(e) => update({ website: e.target.value })} />
        </div>
      </div>
      <div>
        <Label>Logo URL</Label>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <TextInput
            placeholder="https://example.com/logo.png"
            value={form.logo_url}
            onChange={(e) => update({ logo_url: e.target.value })}
            style={{ flex: 1 }}
          />
          {form.logo_url.trim() && (
            <img
              src={form.logo_url.trim()}
              alt=""
              style={{ width: 36, height: 36, borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", objectFit: "contain", background: "var(--surface-card)" }}
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
              onLoad={(e) => {
                e.currentTarget.style.visibility = "visible";
              }}
            />
          )}
        </div>
      </div>
      <div>
        <Label>Categories (comma-separated)</Label>
        <TextInput value={form.categories} onChange={(e) => update({ categories: e.target.value })} />
      </div>
      <div>
        <Label>Sender emails (comma or newline separated)</Label>
        <TextArea
          placeholder="info@bata.com, offers@bata.com"
          value={form.emails}
          onChange={(e) => update({ emails: e.target.value })}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={form.is_active} onChange={(e) => update({ is_active: e.target.checked })} style={{ width: 18, height: 18 }} />
        <span style={{ fontSize: 13, color: "var(--text-body)" }}>Active</span>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <Button onClick={handleSubmit} loading={submitting}>
          {initial ? "Update brand" : "Add brand"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
