import { useAnalytics } from "../api/analytics";
import { Icon } from "../components/icons";
import { BarList } from "../components/ui/BarList";
import { Card, CardHeader } from "../components/ui/Card";
import { LineChart } from "../components/ui/LineChart";
import { VerticalBars } from "../components/ui/VerticalBars";

const VERIFICATION_COLOR: Record<string, string> = {
  verified: "var(--success)",
  suspicious: "var(--warning)",
  invalid: "var(--danger)",
  unverified: "var(--border-strong)",
};

export function Analytics() {
  const { data, isLoading, isError } = useAnalytics();

  if (isLoading) return <div style={{ color: "var(--text-muted)" }}>Loading analytics…</div>;
  if (isError || !data) return <div style={{ color: "var(--danger)" }}>Failed to load analytics.</div>;

  const {
    offers_by_brand,
    offers_by_category,
    top_subcategories,
    offer_types,
    discount_histogram,
    verification_status,
    monthly_trend,
    top_discounted_brands,
    brand_performance,
  } = data;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16 }}>
        <Card>
          <CardHeader icon={<Icon.activity size={16} style={{ color: "var(--brand)" }} />} title="Offers by brand" />
          {offers_by_brand.length ? <BarList items={offers_by_brand} /> : <Empty />}
        </Card>

        <Card>
          <CardHeader icon={<Icon.pie size={16} style={{ color: "var(--brand)" }} />} title="Offers by category" />
          {offers_by_category.length ? <BarList items={offers_by_category} color="var(--azure-400)" /> : <Empty />}
        </Card>

        <Card>
          <CardHeader icon={<Icon.trendUp size={16} style={{ color: "var(--brand)" }} />} title="Top subcategories" />
          {top_subcategories.length ? <BarList items={top_subcategories} color="var(--ai)" /> : <Empty />}
        </Card>

        <Card>
          <CardHeader icon={<Icon.offer size={16} style={{ color: "var(--brand)" }} />} title="Offer types breakdown" />
          {offer_types.length ? <BarList items={offer_types} color="var(--iris-400)" /> : <Empty />}
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(380px, 1fr))", gap: 16 }}>
        <Card>
          <CardHeader icon={<Icon.trendUp size={16} style={{ color: "var(--brand)" }} />} title="Discount % distribution" />
          {discount_histogram.length ? (
            <VerticalBars items={discount_histogram.map((b) => ({ label: b.range, value: b.count }))} />
          ) : (
            <Empty />
          )}
        </Card>

        <Card>
          <CardHeader icon={<Icon.target size={16} style={{ color: "var(--brand)" }} />} title="Verification status" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {verification_status.map((v) => {
              const total = verification_status.reduce((sum, x) => sum + x.count, 0) || 1;
              return (
                <div key={v.status} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 3, background: VERIFICATION_COLOR[v.status] }} />
                  <span style={{ fontSize: 12.5, color: "var(--text-body)", flex: "1 1 auto", textTransform: "capitalize" }}>
                    {v.status}
                  </span>
                  <span style={{ font: "600 12.5px/1 var(--font-mono)", color: "var(--text-strong)" }}>{v.count}</span>
                  <span style={{ font: "500 11.5px/1 var(--font-mono)", color: "var(--text-faint)", width: 42, textAlign: "right" }}>
                    {((v.count / total) * 100).toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader icon={<Icon.trendUp size={16} style={{ color: "var(--brand)" }} />} title="Monthly email trend" />
        {monthly_trend.length ? (
          <LineChart points={monthly_trend.map((m) => ({ label: m.month, value: m.count }))} />
        ) : (
          <Empty />
        )}
      </Card>

      <Card>
        <CardHeader icon={<Icon.sparkle size={16} style={{ color: "var(--ai)" }} />} title="Top discounted brands (avg %)" />
        {top_discounted_brands.length ? (
          <VerticalBars
            items={top_discounted_brands.map((b) => ({ label: b.name, value: b.avg_discount }))}
            color="var(--warning)"
          />
        ) : (
          <Empty />
        )}
      </Card>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
          <CardHeader icon={<Icon.activity size={16} style={{ color: "var(--brand)" }} />} title="Brand performance" />
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 560 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 140px 100px",
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
              <span style={{ textAlign: "right" }}>Offers</span>
              <span style={{ textAlign: "right" }}>Avg discount</span>
              <span style={{ textAlign: "right" }}>Verified</span>
            </div>
            {brand_performance.map((b) => (
              <div
                key={b.brand}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 140px 100px",
                  alignItems: "center",
                  gap: 12,
                  padding: "var(--row-pad) 20px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 12.5,
                }}
              >
                <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{b.brand}</span>
                <span style={{ textAlign: "right", font: "600 12px/1 var(--font-mono)" }}>{b.offers}</span>
                <span style={{ textAlign: "right", font: "600 12px/1 var(--font-mono)" }}>
                  {b.avg_discount != null ? `${b.avg_discount}%` : "—"}
                </span>
                <span style={{ textAlign: "right", font: "600 12px/1 var(--font-mono)", color: "var(--success)" }}>
                  {b.verified}
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
