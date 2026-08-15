import { useOverview } from "../api/overview";
import { BarList } from "../components/ui/BarList";
import { Badge } from "../components/ui/Badge";
import { Card, CardHeader } from "../components/ui/Card";
import { StatCard } from "../components/ui/StatCard";
import { Icon } from "../components/icons";

const VERIFICATION_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  verified: "success",
  suspicious: "warning",
  invalid: "danger",
  unverified: "neutral",
};

const VERIFICATION_COLOR: Record<string, string> = {
  verified: "var(--success)",
  suspicious: "var(--warning)",
  invalid: "var(--danger)",
  unverified: "var(--border-strong)",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

export function Overview() {
  const { data, isLoading, isError } = useOverview();

  if (isLoading) {
    return <div style={{ color: "var(--text-muted)" }}>Loading overview…</div>;
  }

  if (isError || !data) {
    return <div style={{ color: "var(--danger)" }}>Failed to load overview data.</div>;
  }

  const { kpis, top_brands, top_categories, top_subcategories, verification_status, latest_offers } = data;

  if (kpis.total_offers === 0) {
    return (
      <Card>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>
          No emails processed yet. Click "Run fetch &amp; analyse now" in the sidebar.
        </p>
      </Card>
    );
  }

  const verifiedShare = ((kpis.verified / kpis.total_offers) * 100).toFixed(1);
  const totalVerification = verification_status.reduce((sum, v) => sum + v.count, 0) || 1;

  let cumulative = 0;
  const conicStops = verification_status
    .map((v) => {
      const start = (cumulative / totalVerification) * 100;
      cumulative += v.count;
      const end = (cumulative / totalVerification) * 100;
      return `${VERIFICATION_COLOR[v.status]} ${start}% ${end}%`;
    })
    .join(", ");

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(238px, 1fr))", gap: 16 }}>
        <StatCard
          icon={<Icon.offer size={17} />}
          iconColor="var(--brand)"
          iconBg="var(--brand-subtle)"
          label="Total offers"
          value={kpis.total_offers.toLocaleString()}
          caption="Extracted from your inbox"
        />
        <StatCard
          icon={<Icon.check size={17} />}
          iconColor="var(--success)"
          iconBg="var(--success-subtle)"
          label="Verified"
          value={kpis.verified.toLocaleString()}
          valueColor="var(--success)"
          caption={`${verifiedShare}% of the catalogue passed all checks`}
        />
        <StatCard
          icon={<Icon.x size={17} />}
          iconColor="var(--danger)"
          iconBg="var(--danger-subtle)"
          label="Invalid"
          value={kpis.invalid.toLocaleString()}
          valueColor="var(--danger)"
          caption="Codes rejected or already expired"
        />
        <StatCard
          icon={<Icon.clock size={17} />}
          iconColor="#1B1405"
          iconBg="var(--warning)"
          labelColor="var(--amber-600)"
          label="Expiring in 7 days"
          value={kpis.expiring_soon.toLocaleString()}
          valueColor="var(--warning)"
          caption="Review before they lapse"
          gradient
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16 }}>
        <Card>
          <CardHeader icon={<Icon.activity size={16} style={{ color: "var(--brand)" }} />} title="Top brands" />
          {top_brands.length ? <BarList items={top_brands} /> : <Empty />}
        </Card>

        <Card>
          <CardHeader icon={<Icon.pie size={16} style={{ color: "var(--brand)" }} />} title="Top categories" />
          {top_categories.length ? <BarList items={top_categories} color="var(--primary-400)" /> : <Empty />}
        </Card>

        <Card>
          <CardHeader icon={<Icon.trendUp size={16} style={{ color: "var(--brand)" }} />} title="Top subcategories" />
          {top_subcategories.length ? <BarList items={top_subcategories} color="var(--ai)" /> : <Empty />}
        </Card>

        <Card>
          <CardHeader icon={<Icon.target size={16} style={{ color: "var(--brand)" }} />} title="Verification status" />
          <div style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap" }}>
            <div
              style={{
                position: "relative",
                width: 148,
                height: 148,
                flex: "0 0 148px",
                borderRadius: "50%",
                background: `conic-gradient(${conicStops})`,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 26,
                  borderRadius: "50%",
                  background: "var(--surface-card)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 2,
                }}
              >
                <div style={{ font: "800 26px/1 var(--font-mono)", color: "var(--text-strong)" }}>
                  {kpis.total_offers}
                </div>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "var(--ls-wide)",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                  }}
                >
                  offers
                </div>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: "1 1 160px", minWidth: 150 }}>
              {verification_status.map((v) => (
                <div key={v.status} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: 3,
                      background: VERIFICATION_COLOR[v.status],
                    }}
                  />
                  <span style={{ fontSize: 12.5, color: "var(--text-body)", flex: "1 1 auto", textTransform: "capitalize" }}>
                    {v.status}
                  </span>
                  <span style={{ font: "600 12.5px/1 var(--font-mono)", color: "var(--text-strong)" }}>{v.count}</span>
                  <span style={{ font: "500 11.5px/1 var(--font-mono)", color: "var(--text-faint)", width: 42, textAlign: "right" }}>
                    {((v.count / totalVerification) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            flexWrap: "wrap",
          }}
        >
          <h2 style={{ margin: 0, font: "var(--fw-semibold) 15px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>
            Latest offers
          </h2>
          <span style={{ font: "500 11.5px/1 var(--font-mono)", color: "var(--text-faint)" }}>
            showing {latest_offers.length} of {kpis.total_offers}
          </span>
        </div>

        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 1100 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "130px 130px 100px 90px 140px 100px 120px minmax(240px,1fr)",
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
              <span>Type</span>
              <span style={{ textAlign: "right" }}>Discount</span>
              <span>Coupon code</span>
              <span>Expiry</span>
              <span>Verification</span>
              <span>AI summary</span>
            </div>

            {latest_offers.map((offer) => (
              <div
                key={offer.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "130px 130px 100px 90px 140px 100px 120px minmax(240px,1fr)",
                  alignItems: "center",
                  gap: 12,
                  padding: "var(--row-pad) 20px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 12.5,
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{offer.brand ?? "—"}</span>
                <span>{offer.category ?? "—"}</span>
                <span style={{ color: "var(--text-muted)" }}>{offer.offer_type ?? "—"}</span>
                <span style={{ font: "700 13px/1 var(--font-mono)", color: "var(--text-strong)", textAlign: "right" }}>
                  {offer.discount_percentage != null ? `${offer.discount_percentage}%` : "—"}
                </span>
                <span>
                  {offer.coupon_code ? (
                    <span
                      style={{
                        font: "600 11.5px/1 var(--font-mono)",
                        color: "var(--brand)",
                        background: "var(--brand-subtle)",
                        border: "1px dashed var(--brand-subtle-2)",
                        borderRadius: "var(--radius-pill)",
                        padding: "5px 10px",
                      }}
                    >
                      {offer.coupon_code}
                    </span>
                  ) : (
                    <span style={{ font: "500 12px/1 var(--font-mono)", color: "var(--text-faint)" }}>no code</span>
                  )}
                </span>
                <span style={{ font: "500 12px/1 var(--font-mono)", color: "var(--text-body)" }}>
                  {formatDate(offer.expiry_date)}
                </span>
                <Badge tone={VERIFICATION_TONE[offer.verification_status] ?? "neutral"}>
                  {offer.verification_status}
                </Badge>
                <span
                  style={{
                    color: "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {offer.summary ?? "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </>
  );
}

function Empty() {
  return <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>No data available.</div>;
}
