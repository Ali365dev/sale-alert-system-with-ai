import { useEffect, useState } from "react";

import { useEmailProcessing, useGmailLabels, useUpdateEmailProcessing, type EmailProcessingSettings } from "../../api/settings";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { FieldGroup, Label, Select, TextInput } from "../ui/Field";
import { LoadingState } from "../ui/Spinner";

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--text-body)", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16 }} />
      {label}
    </label>
  );
}

export function EmailProcessingTab() {
  const { data, isLoading } = useEmailProcessing();
  const update = useUpdateEmailProcessing();
  const [labelMode, setLabelMode] = useState<"existing" | "new">("existing");
  const gmailLabels = useGmailLabels(labelMode === "existing");

  const [form, setForm] = useState<Partial<EmailProcessingSettings>>({});

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  if (isLoading || !data) return <LoadingState />;

  function set<K extends string>(key: K, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(data);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <CardHeader title="Gmail Label" />
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
          Emails under this label are what gets fetched &amp; analysed. Changing it takes effect on the very next
          sync — no restart needed.
        </p>
        <div style={{ display: "flex", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="radio" checked={labelMode === "existing"} onChange={() => setLabelMode("existing")} />
            Choose existing
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input type="radio" checked={labelMode === "new"} onChange={() => setLabelMode("new")} />
            Create new
          </label>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <FieldGroup>
            <Label>Sync label (fetch &amp; analyse from here)</Label>
            {labelMode === "existing" ? (
              <Select value={String(form.gmail_label ?? "")} onChange={(e) => set("gmail_label", e.target.value)}>
                <option value={String(form.gmail_label ?? "")}>{String(form.gmail_label ?? "")} (current)</option>
                {gmailLabels.data?.filter((l) => l.name !== form.gmail_label).map((l) => (
                  <option key={l.id} value={l.name}>
                    {l.name}
                  </option>
                ))}
              </Select>
            ) : (
              <TextInput value={String(form.gmail_label ?? "")} onChange={(e) => set("gmail_label", e.target.value)} placeholder="new-label-name" />
            )}
          </FieldGroup>
          <FieldGroup>
            <Label>Brand-match label (auto-labeling job)</Label>
            <TextInput value={String(form.gmail_brand_label ?? "")} onChange={(e) => set("gmail_brand_label", e.target.value)} />
          </FieldGroup>
        </div>
      </Card>

      <Card>
        <CardHeader title="Processing" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          <FieldGroup>
            <Label>Max emails per sync</Label>
            <TextInput type="number" min={1} max={500} value={String(form.max_emails_per_sync ?? "")} onChange={(e) => set("max_emails_per_sync", Number(e.target.value))} />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Caps "Fetch &amp; Analyse Emails" per run. Any unfinished backlog is worked off first, then the most recent new emails fill the rest — never the oldest.
            </span>
          </FieldGroup>
          <FieldGroup>
            <Label>Fetch only latest N emails</Label>
            <TextInput
              type="number"
              min={1}
              placeholder="No limit"
              value={form.latest_emails_limit == null ? "" : String(form.latest_emails_limit)}
              onChange={(e) => set("latest_emails_limit", e.target.value === "" ? null : Number(e.target.value))}
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Only look at the N most recent emails under the Gmail label — anything older is never fetched, so already-expired old offers stop getting pulled in. Leave blank for no limit.
            </span>
          </FieldGroup>
          <FieldGroup>
            <Label>Retry attempts</Label>
            <TextInput type="number" min={1} max={10} value={String(form.retry_attempts ?? "")} onChange={(e) => set("retry_attempts", Number(e.target.value))} />
          </FieldGroup>
          <FieldGroup>
            <Label>Request timeout (seconds)</Label>
            <TextInput type="number" min={5} max={300} value={String(form.request_timeout_seconds ?? "")} onChange={(e) => set("request_timeout_seconds", Number(e.target.value))} />
          </FieldGroup>
          <FieldGroup>
            <Label>Max OCR images per email</Label>
            <TextInput
              type="number"
              min={1}
              max={50}
              value={String(form.ocr_max_images_per_email ?? "")}
              onChange={(e) => set("ocr_max_images_per_email", Number(e.target.value))}
            />
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              How many images/GIFs per email get sent through OCR. Higher catches more promo text baked into images, but slower.
            </span>
          </FieldGroup>
          <FieldGroup>
            <Label>Fetch interval (minutes)</Label>
            <TextInput type="number" min={5} value={String(form.fetch_interval_minutes ?? "")} onChange={(e) => set("fetch_interval_minutes", Number(e.target.value))} />
            <span style={{ fontSize: 11, color: "var(--warning)" }}>Stored, but no scheduler exists yet — runs are still manual/on-demand.</span>
          </FieldGroup>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <ToggleRow label="Automatically analyze emails" checked={!!form.auto_analyze_emails} onChange={(v) => set("auto_analyze_emails", v)} />
          <ToggleRow label="Automatically apply Gmail label" checked={!!form.auto_apply_gmail_label} onChange={(v) => set("auto_apply_gmail_label", v)} />
          <ToggleRow label="Skip already-labeled emails" checked={!!form.skip_already_labeled} onChange={(v) => set("skip_already_labeled", v)} />
          <ToggleRow label="Skip duplicate emails" checked={!!form.skip_duplicate_emails} onChange={(v) => set("skip_duplicate_emails", v)} />
        </div>
      </Card>

      <div>
        <Button loading={update.isPending} disabled={!dirty} onClick={() => update.mutate(form)}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
