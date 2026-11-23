import { useState } from "react";

import type { SearchFilters } from "../api/search";
import { exportSearchCsvUrl, useSearch } from "../api/search";
import { formatTableDate, humanize, VERIFICATION_LABEL, VERIFICATION_TONE } from "../lib/tableFormat";
import { Icon } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { DataTable, DataTableBody, DataTableEmpty, DataTableHead, DataTableRow } from "../components/ui/DataTable";
import { LoadingState } from "../components/ui/Spinner";
import { Label, Select, TextInput } from "../components/ui/Field";


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
            {isLoading ? "Searching…" : `${data?.count ?? 0} ${data?.count === 1 ? "offer" : "offers"} found`}
          </span>
          <div style={{ flex: "1 1 auto" }} />
          <a href={exportSearchCsvUrl(filters)} download className="link-button">
            <Icon.download size={14} aria-hidden="true" />
            Export CSV
          </a>
        </div>

        {isError && <div style={{ padding: 20, color: "var(--danger)" }}>Search failed. Try again in a moment</div>}

        {isLoading && <div style={{ padding: 20 }}><LoadingState label="Searching offers…" /></div>}

        {!isLoading && data && (
          <DataTable
            label="Search results"
            columns="136px 120px 80px 128px 112px 112px minmax(220px, 1fr) 112px"
            minWidth={1100}
            align={{ 2: "right" }}
          >
            <DataTableHead>
              <span>Brand</span>
              <span>Category</span>
              <span>Discount</span>
              <span>Code</span>
              <span>Expires</span>
              <span>Verification</span>
              <span>Email subject</span>
              <span>Received</span>
            </DataTableHead>
            <DataTableBody>
              {data.results.length === 0 && <DataTableEmpty>No offers match these filters</DataTableEmpty>}
              {data.results.map((row) => (
                <DataTableRow key={row.id}>
                  <span className="dt-strong dt-truncate">{row.brand ?? "—"}</span>
                  <span className="dt-truncate">{row.category ?? "—"}</span>
                  <span className="dt-num">{row.discount_percentage != null ? `${row.discount_percentage}%` : "—"}</span>
                  <span className={row.coupon_code ? "dt-truncate" : "dt-faint"} style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                    {row.coupon_code ?? "No code"}
                  </span>
                  <span className="dt-date">{formatTableDate(row.expiry_date)}</span>
                  <Badge tone={VERIFICATION_TONE[row.verification_status] ?? "neutral"}>
                    {VERIFICATION_LABEL[row.verification_status] ?? humanize(row.verification_status)}
                  </Badge>
                  <span className="dt-truncate dt-muted" title={row.subject ?? undefined}>{row.subject ?? "—"}</span>
                  <span className="dt-date dt-muted">{formatTableDate(row.received_date)}</span>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        )}
      </Card>
    </>
  );
}
