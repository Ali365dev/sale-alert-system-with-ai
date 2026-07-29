import { useState } from "react";

import type { SearchFilters } from "../api/search";
import { exportSearchCsvUrl, useSearch } from "../api/search";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Label, Select, TextInput } from "../components/ui/Field";

const VERIFICATION_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  verified: "success",
  suspicious: "warning",
  invalid: "danger",
  unverified: "neutral",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "2-digit", year: "numeric" });
}

export function Search() {
  const [draft, setDraft] = useState<SearchFilters>({});
  const [filters, setFilters] = useState<SearchFilters>({});
  const { data, isLoading, isError } = useSearch(filters);

  const update = (patch: Partial<SearchFilters>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <>
      <Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <div>
            <Label>Brand</Label>
            <TextInput placeholder="e.g. Nike" value={draft.brand ?? ""} onChange={(e) => update({ brand: e.target.value })} />
          </div>
          <div>
            <Label>Subject</Label>
            <TextInput placeholder="e.g. Flash Sale" value={draft.subject ?? ""} onChange={(e) => update({ subject: e.target.value })} />
          </div>
          <div>
            <Label>Verification status</Label>
            <Select value={draft.verification_status ?? ""} onChange={(e) => update({ verification_status: e.target.value })}>
              <option value="">All</option>
              <option value="verified">Verified</option>
              <option value="suspicious">Suspicious</option>
              <option value="invalid">Invalid</option>
              <option value="unverified">Unverified</option>
            </Select>
          </div>
          <div>
            <Label>Min discount %</Label>
            <TextInput
              type="number"
              min={0}
              max={100}
              value={draft.min_discount ?? ""}
              onChange={(e) => update({ min_discount: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>
          <div>
            <Label>Received from</Label>
            <TextInput type="date" value={draft.date_from ?? ""} onChange={(e) => update({ date_from: e.target.value })} />
          </div>
          <div>
            <Label>Received to</Label>
            <TextInput type="date" value={draft.date_to ?? ""} onChange={(e) => update({ date_to: e.target.value })} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button onClick={() => setFilters(draft)}>Search</Button>
          <Button
            variant="ghost"
            onClick={() => {
              setDraft({});
              setFilters({});
            }}
          >
            Clear
          </Button>
        </div>
      </Card>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ font: "600 13px/1 var(--font-sans)", color: "var(--text-strong)" }}>
            {isLoading ? "Searching…" : `${data?.count ?? 0} offer(s) found`}
          </span>
          <div style={{ flex: "1 1 auto" }} />
          <a href={exportSearchCsvUrl(filters)} download>
            <Button variant="secondary" size="sm">
              Export CSV
            </Button>
          </a>
        </div>

        {isError && <div style={{ padding: 20, color: "var(--danger)" }}>Failed to search offers.</div>}

        {!isLoading && data && (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 1200 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "120px 110px 90px 130px 90px 120px 1fr 160px",
                  gap: 12,
                  padding: "11px 20px",
                  background: "var(--surface-sunken)",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "var(--ls-wide)",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                <span>Brand</span>
                <span>Category</span>
                <span style={{ textAlign: "right" }}>Disc %</span>
                <span>Code</span>
                <span>Expires</span>
                <span>Verification</span>
                <span>Subject</span>
                <span>Received</span>
              </div>
              {data.results.map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "120px 110px 90px 130px 90px 120px 1fr 160px",
                    alignItems: "center",
                    gap: 12,
                    padding: "var(--row-pad) 20px",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 12.5,
                  }}
                >
                  <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{row.brand ?? "—"}</span>
                  <span>{row.category ?? "—"}</span>
                  <span style={{ textAlign: "right", font: "700 13px/1 var(--font-mono)", color: "var(--text-strong)" }}>
                    {row.discount_percentage != null ? `${row.discount_percentage}%` : "—"}
                  </span>
                  <span style={{ font: "600 11.5px/1 var(--font-mono)", color: "var(--text-muted)" }}>
                    {row.coupon_code ?? "—"}
                  </span>
                  <span style={{ font: "500 12px/1 var(--font-mono)" }}>{formatDate(row.expiry_date)}</span>
                  <Badge tone={VERIFICATION_TONE[row.verification_status] ?? "neutral"}>{row.verification_status}</Badge>
                  <span
                    style={{
                      color: "var(--text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.subject ?? "—"}
                  </span>
                  <span style={{ font: "500 12px/1 var(--font-mono)", color: "var(--text-muted)" }}>
                    {formatDate(row.received_date)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
