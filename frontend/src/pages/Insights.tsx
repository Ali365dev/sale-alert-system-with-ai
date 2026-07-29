import { useState } from "react";

import {
  useFetchSalesWeb,
  useFetchSalesWebStatus,
  useResearchBrands,
  useResearchBrandsStatus,
} from "../api/actions";
import type { HighlightItem, InsightOffer, RecommendedAction } from "../api/insights";
import { useInsights } from "../api/insights";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Icon } from "../components/icons";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

function daysLeft(iso: string | null) {
  if (!iso) return null;
  const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

function OfferCard({ offer, rank }: { offer: InsightOffer; rank: number }) {
  return (
    <Card style={{ padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Badge tone={rank === 0 ? "success" : "brand"}>Priority {rank + 1}</Badge>
        <Badge tone="ai">AI picked</Badge>
        {offer.expiry_date && (
          <span style={{ marginLeft: "auto", font: "500 11.5px/1 var(--font-mono)", color: "var(--warning)" }}>
            {daysLeft(offer.expiry_date)} days left
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span style={{ font: "800 32px/1 var(--font-mono)", letterSpacing: "var(--ls-tight)", color: "var(--text-strong)" }}>
          {offer.discount_percentage != null ? `${offer.discount_percentage}%` : "—"}
        </span>
        <span style={{ fontWeight: 600, fontSize: 15, color: "var(--text-strong)" }}>{offer.brand ?? "Unknown"}</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--text-muted)" }}>{offer.summary ?? "—"}</p>
      {offer.coupon_code && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "auto" }}>
          <span
            style={{
              font: "700 12.5px/1 var(--font-mono)",
              color: "var(--brand)",
              background: "var(--brand-subtle)",
              border: "1px dashed var(--brand-subtle-2)",
              borderRadius: "var(--radius-pill)",
              padding: "8px 12px",
            }}
          >
            {offer.coupon_code}
          </span>
          <Button
            size="sm"
            variant={rank === 0 ? "primary" : "secondary"}
            onClick={() => navigator.clipboard.writeText(offer.coupon_code!)}
          >
            Copy code
          </Button>
        </div>
      )}
    </Card>
  );
}

function ExpiringRow({ offer }: { offer: InsightOffer }) {
  const left = daysLeft(offer.expiry_date);
  const urgent = left !== null && left <= 2;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "13px 20px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: "1 1 auto", minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-strong)" }}>
          {offer.brand ?? "Unknown"} · {offer.summary ?? offer.category ?? "Offer"}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Expires {formatDate(offer.expiry_date)} · {offer.coupon_code ?? offer.verification_status}
        </div>
      </div>
      <span
        style={{
          font: "700 11px/1 var(--font-mono)",
          color: urgent ? "#1B1405" : "var(--text-body)",
          background: urgent ? "var(--warning)" : "var(--surface-sunken)",
          borderRadius: "var(--radius-pill)",
          padding: "5px 9px",
        }}
      >
        {left} {left === 1 ? "day" : "days"}
      </span>
    </div>
  );
}

function ActionRow({ action }: { action: RecommendedAction }) {
  const [done, setDone] = useState(action.done);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
      <input type="checkbox" checked={done} onChange={() => setDone((d) => !d)} style={{ width: 18, height: 18, marginTop: 2 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <div
          style={{
            fontWeight: 600,
            fontSize: 13,
            color: "var(--text-strong)",
            textDecoration: done ? "line-through" : undefined,
            opacity: done ? 0.6 : 1,
          }}
        >
          {action.title}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{action.detail}</div>
      </div>
    </div>
  );
}

function HighlightRow({ item }: { item: HighlightItem }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "24px minmax(0,1fr)",
        alignItems: "start",
        gap: 12,
        padding: "14px 20px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: 8,
          background: "var(--ai-subtle)",
          color: "var(--ai)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon.sparkle size={13} />
      </span>
      <span style={{ fontSize: 13, lineHeight: 1.5, color: "var(--text-body)" }}>
        {item.brand && <strong style={{ color: "var(--text-strong)" }}>{item.brand}: </strong>}
        {item.text}
      </span>
    </div>
  );
}

function PipelineActions() {
  const fetchSalesWeb = useFetchSalesWeb();
  const fetchSalesWebStatus = useFetchSalesWebStatus(fetchSalesWeb.isPending || fetchSalesWeb.isSuccess);
  const salesRunning = fetchSalesWebStatus.data?.running ?? false;

  const researchBrands = useResearchBrands();
  const researchStatus = useResearchBrandsStatus(researchBrands.isPending || researchBrands.isSuccess);
  const researchRunning = researchStatus.data?.running ?? false;

  return (
    <Card>
      <CardHeader title="Pipeline actions" icon={<Icon.sparkle size={16} style={{ color: "var(--ai)" }} />} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button loading={fetchSalesWeb.isPending || salesRunning} onClick={() => fetchSalesWeb.mutate()}>
          Fetch sales from web (AI)
        </Button>
        <Button variant="secondary" loading={researchBrands.isPending || researchRunning} onClick={() => researchBrands.mutate()}>
          Research brands (Tavily + Llama)
        </Button>
      </div>
      {(salesRunning || (fetchSalesWebStatus.data && fetchSalesWebStatus.data.done > 0)) && (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {salesRunning
            ? `Searching brand ${fetchSalesWebStatus.data?.done}/${fetchSalesWebStatus.data?.total}…`
            : `Done — ${fetchSalesWebStatus.data?.saved} offer(s) saved (${fetchSalesWebStatus.data?.total_active} active), ${fetchSalesWebStatus.data?.failed} failed.`}
        </div>
      )}
      {(researchRunning || (researchStatus.data && researchStatus.data.done > 0)) && (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {researchRunning
            ? `Researching brand ${researchStatus.data?.done}/${researchStatus.data?.total}…`
            : `Done — ${researchStatus.data?.inserted} inserted, ${researchStatus.data?.updated} updated` +
              (researchStatus.data?.failed_brands.length ? ` · skipped: ${researchStatus.data.failed_brands.join(", ")}` : "")}
        </div>
      )}
    </Card>
  );
}

export function Insights() {
  const { data, isLoading, isError } = useInsights();

  if (isLoading) return <div style={{ color: "var(--text-muted)" }}>Loading insights…</div>;
  if (isError || !data) return <div style={{ color: "var(--danger)" }}>Failed to load insights.</div>;

  const { digest, stats, best_offers, expiring_soon, recommended_actions, highlights } = data;

  return (
    <>
      <PipelineActions />

      <Card
        style={{
          borderColor: "var(--ai-subtle)",
          boxShadow: "var(--shadow-md)",
          background: "linear-gradient(140deg, var(--ai-subtle), var(--surface-card) 72%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Icon.sparkle size={18} style={{ color: "var(--ai)" }} />
          <h2 style={{ margin: 0, font: "var(--fw-bold) 19px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>
            Today's AI digest
          </h2>
          <Badge tone="ai">Gemini</Badge>
        </div>
        <p style={{ margin: 0, maxWidth: "76ch", fontSize: 15, lineHeight: 1.55, color: "var(--text-body)" }}>
          {digest ?? "Daily summary not available — check the AI provider configuration."}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
          {[
            { label: "Emails read", value: stats.emails_read, color: "var(--text-strong)" },
            { label: "New offers", value: stats.new_offers, color: "var(--ai)" },
            { label: "Avg discount", value: `${stats.avg_discount}%`, color: "var(--text-strong)" },
            { label: "Flagged", value: stats.flagged, color: "var(--warning)" },
          ].map((s) => (
            <div key={s.label} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)", background: "var(--surface-app)", padding: "13px 15px", display: "flex", flexDirection: "column", gap: 5 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-muted)" }}>
                {s.label}
              </div>
              <div style={{ font: "700 21px/1 var(--font-mono)", color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <h2 style={{ margin: 0, font: "var(--fw-semibold) 16px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>
            Best offers right now
          </h2>
        </div>
        {best_offers.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(288px, 1fr))", gap: 16 }}>
            {best_offers.map((o, i) => (
              <OfferCard key={o.id} offer={o} rank={i} />
            ))}
          </div>
        ) : (
          <Card>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No offers to rank yet.</span>
          </Card>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 16, alignItems: "start" }}>
        <Card padded={false} style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <CardHeader
              icon={<Icon.alert size={16} style={{ color: "var(--warning)" }} />}
              title="Expiring within 7 days"
              aside={<Badge tone="warning">{expiring_soon.length}</Badge>}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {expiring_soon.length ? (
              expiring_soon.map((o) => <ExpiringRow key={o.id} offer={o} />)
            ) : (
              <div style={{ padding: "16px 20px", fontSize: 12.5, color: "var(--text-muted)" }}>
                No offers expiring within the next 7 days.
              </div>
            )}
          </div>
        </Card>

        <Card padded={false} style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <CardHeader icon={<Icon.check size={16} style={{ color: "var(--brand)" }} />} title="Recommended actions" />
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {recommended_actions.length ? (
              recommended_actions.map((a) => <ActionRow key={a.id} action={a} />)
            ) : (
              <div style={{ padding: "16px 20px", fontSize: 12.5, color: "var(--text-muted)" }}>
                No recommended actions right now.
              </div>
            )}
          </div>
        </Card>
      </div>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <CardHeader icon={<Icon.sparkle size={16} style={{ color: "var(--ai)" }} />} title="AI key highlights" />
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {highlights.length ? (
            highlights.map((h, i) => <HighlightRow key={i} item={h} />)
          ) : (
            <div style={{ padding: "16px 20px", fontSize: 12.5, color: "var(--text-muted)" }}>No highlights yet.</div>
          )}
        </div>
      </Card>
    </>
  );
}
