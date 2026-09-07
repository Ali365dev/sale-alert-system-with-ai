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
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 140px 1fr 140px 130px 300px",
        alignItems: "center",
        gap: 12,
        padding: "12px 20px",
        borderBottom: "1px solid var(--border)",
        fontSize: 12.5,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {request.brand_name}
        </div>
        {request.device_id && (
          <div style={{ color: "var(--text-faint)", fontSize: 11, fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {request.device_id}
          </div>
        )}
      </div>
      <span style={{ color: request.category ? "var(--text-body)" : "var(--text-faint)" }}>{request.category ?? "—"}</span>
      <span
        style={{
          color: request.note ? "var(--text-muted)" : "var(--text-faint)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={request.note ?? undefined}
      >
        {request.note ?? "—"}
      </span>
      <span style={{ font: "500 12px/1 var(--font-mono)", color: "var(--text-muted)" }}>{formatDateTime(request.created_at)}</span>
      <Badge tone={STATUS_TONE[request.status]}>{STATUS_LABEL[request.status]}</Badge>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {request.status === "pending" ? (
          <>
            <Link
              to={`/discover-brand?requestId=${request.id}&name=${encodeURIComponent(request.brand_name)}`}
              title="Find this brand's official website, logo, and social links"
            >
              <Button size="sm" variant="secondary" type="button">
                Discover
              </Button>
            </Link>
            <Button size="sm" variant="secondary" loading={pending} onClick={() => updateStatus.mutate({ id: request.id, status: "added" })}>
              Mark added
            </Button>
            <Button size="sm" variant="danger" loading={pending} onClick={() => updateStatus.mutate({ id: request.id, status: "rejected" })}>
              Reject
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" loading={pending} onClick={() => updateStatus.mutate({ id: request.id, status: "pending" })}>
            Reopen
          </Button>
        )}
      </div>
    </div>
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
        Brands users have asked for but DealPulse doesn't track yet — a signal for what to add next.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <StatCard icon={<Icon.store size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Total requests" value={counts.total} />
        <StatCard icon={<Icon.clock size={17} />} iconColor="var(--amber-600)" iconBg="var(--warning-subtle)" label="Pending" value={counts.pending} />
        <StatCard icon={<Icon.check size={17} />} iconColor="var(--success)" iconBg="var(--success-subtle)" label="Added" value={counts.added} />
        <StatCard icon={<Icon.x size={17} />} iconColor="var(--red-600)" iconBg="var(--danger-subtle)" label="Rejected" value={counts.rejected} />
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

        {isLoading && <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>}
        {!isLoading && filtered.length === 0 && (
          <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>No requests here yet.</div>
        )}

        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 980 }}>
            {filtered.map((request) => (
              <RequestRow key={request.id} request={request} />
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}
