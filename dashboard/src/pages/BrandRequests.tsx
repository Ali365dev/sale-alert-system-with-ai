import { useMemo, useState } from "react";
import { Link } from "react-router";

import {
  useBrandRequests,
  useUpdateBrandRequestStatus,
  type BrandRequest,
  type BrandRequestStatus,
} from "../api/brandRequests";
import { Icon } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button, IconButton } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { DataTable, DataTableBody, DataTableEmpty, DataTableHead, DataTableRow } from "../components/ui/DataTable";
import { StatCard } from "../components/ui/StatCard";

const STATUS_TONE: Record<BrandRequestStatus, "success" | "warning" | "danger"> = {
  pending: "warning",
  added: "success",
  rejected: "danger",
};

const STATUS_LABEL: Record<BrandRequestStatus, string> = {
  pending: "Pending",
  added: "Added",
  rejected: "Rejected",
};

const TABS: Array<{ key: "all" | BrandRequestStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "added", label: "Added" },
  { key: "rejected", label: "Rejected" },
];

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function RequestRow({ request }: { request: BrandRequest }) {
  const updateStatus = useUpdateBrandRequestStatus();
  const pending = updateStatus.isPending;

  return (
    <DataTableRow muted={request.status !== "pending"}>
      <div style={{ minWidth: 0 }}>
        <div className="dt-strong dt-truncate">{request.brand_name}</div>
        {request.device_id && (
          <div className="dt-truncate dt-faint" style={{ fontSize: "0.75rem", fontFamily: "var(--font-mono)" }} title={request.device_id}>
            {request.device_id}
          </div>
        )}
      </div>
      <span className={request.category ? "dt-truncate" : "dt-faint"}>{request.category ?? "—"}</span>
      <span className={request.note ? "dt-truncate dt-muted" : "dt-faint"} title={request.note ?? undefined}>
        {request.note ?? "—"}
      </span>
      <span className="dt-date dt-muted">{formatDateTime(request.created_at)}</span>
      <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
      <span style={{ display: "flex", gap: 8 }}>
        {request.status === "pending" ? (
          <>
            <Link
              to={`/discover-brand?requestId=${request.id}&name=${encodeURIComponent(request.brand_name)}`}
              title="Find this brand's website, logo and social links"
              className="link-button"
              style={{ height: 32, padding: "0 12px" }}
            >
              Discover
            </Link>
            <Button size="sm" variant="secondary" loading={pending} onClick={() => updateStatus.mutate({ id: request.id, status: "added" })}>
              Mark added
            </Button>
            <IconButton
              icon={<Icon.x size={14} />}
              label="Reject request"
              variant="danger"
              loading={pending}
              onClick={() => updateStatus.mutate({ id: request.id, status: "rejected" })}
            />
          </>
        ) : (
          <Button size="sm" variant="ghost" loading={pending} onClick={() => updateStatus.mutate({ id: request.id, status: "pending" })}>
            Reopen
          </Button>
        )}
      </span>
    </DataTableRow>
  );
}

export function BrandRequests() {
  const { data, isLoading } = useBrandRequests();
  const [tab, setTab] = useState<"all" | BrandRequestStatus>("all");

  const requests = data?.requests ?? [];
  const counts = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((r) => r.status === "pending").length,
      added: requests.filter((r) => r.status === "added").length,
      rejected: requests.filter((r) => r.status === "rejected").length,
    }),
    [requests],
  );
  const filtered = tab === "all" ? requests : requests.filter((r) => r.status === tab);

  return (
    <>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
        Brands users have asked for but DealsMore doesn't track yet — a signal for what to add next.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <StatCard label="Total requests" value={counts.total} />
        <StatCard label="Pending" value={counts.pending} />
        <StatCard label="Added" value={counts.added} />
        <StatCard label="Rejected" value={counts.rejected} />
      </div>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 20px 0", borderBottom: "1px solid var(--border)" }}>
          <CardHeader title="Requests" />
          <div style={{ display: "flex", gap: 6, padding: "12px 0 16px" }}>
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-pill)",
                  padding: "6px 12px",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: tab === key ? "var(--brand-subtle)" : "var(--surface-card)",
                  color: tab === key ? "var(--brand)" : "var(--text-body)",
                }}
              >
                {label}
                {key !== "all" && ` (${counts[key]})`}
              </button>
            ))}
          </div>
        </div>

        <DataTable label="Brand requests" columns="minmax(200px, 1fr) 136px minmax(200px, 1fr) 136px 112px 248px" minWidth={1000} stickyActions>
          <DataTableHead>
            <span>Brand</span>
            <span>Category</span>
            <span>Note</span>
            <span>Requested</span>
            <span>Status</span>
            <span>Actions</span>
          </DataTableHead>
          <DataTableBody>
            {isLoading && <DataTableEmpty>Loading requests…</DataTableEmpty>}
            {!isLoading && filtered.length === 0 && <DataTableEmpty>No requests here yet</DataTableEmpty>}
            {filtered.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))}
          </DataTableBody>
        </DataTable>
      </Card>
    </>
  );
}
