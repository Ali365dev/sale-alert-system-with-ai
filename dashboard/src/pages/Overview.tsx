import { useOverview } from "../api/overview";
import { useRegionStore } from "../store/regionStore";
import { LatestOffersTable } from "../components/overview/LatestOffersTable";
import { VerificationCard } from "../components/overview/VerificationCard";
import { BarList } from "../components/ui/BarList";
import { Card, CardHeader } from "../components/ui/Card";
import { LoadingState } from "../components/ui/Spinner";
import { StatCard } from "../components/ui/StatCard";
import "../components/overview/Overview.css";

export function Overview() {
  const region = useRegionStore((s) => s.region);
  const { data, isLoading, isError } = useOverview(region);

  if (isLoading) return <LoadingState />;

  if (isError || !data) {
    return <Card><p style={{ margin: 0, color: "var(--text-muted)" }}>The overview couldn't load. Refresh the page to try again.</p></Card>;
  }

  const { kpis, top_brands, top_categories, top_subcategories, verification_status, latest_offers } = data;

  if (kpis.total_offers === 0) {
    return (
      <Card>
        <p style={{ margin: 0, color: "var(--text-muted)" }}>
          No offers yet. Use Fetch new emails in the sidebar to pull the latest brand emails.
        </p>
      </Card>
    );
  }

  const share = (n: number) => `${((n / kpis.total_offers) * 100).toFixed(1)}% of all offers`;

  return (
    <>
      <div className="overview-stats">
        <StatCard label="Total offers" value={kpis.total_offers.toLocaleString()} caption="Extracted from brand emails" />
        <StatCard label="Verified" value={kpis.verified.toLocaleString()} caption={share(kpis.verified)} />
        <StatCard
          label="Invalid"
          value={kpis.invalid.toLocaleString()}
          valueColor={kpis.invalid > 0 ? "var(--danger)" : undefined}
          caption="Codes rejected or already expired"
        />
        <StatCard
          label="Expiring in 7 days"
          value={kpis.expiring_soon.toLocaleString()}
          valueColor={kpis.expiring_soon > 0 ? "var(--amber-600)" : undefined}
          caption="Review before they lapse"
        />
      </div>

      <VerificationCard statuses={verification_status} total={kpis.total_offers} />

      <div className="overview-ranked">
        <Card>
          <CardHeader title="Top brands" />
          {top_brands.length ? <BarList items={top_brands} /> : <Empty />}
        </Card>
        <Card>
          <CardHeader title="Top categories" />
          {top_categories.length ? <BarList items={top_categories} /> : <Empty />}
        </Card>
        <Card>
          <CardHeader title="Top subcategories" />
          {top_subcategories.length ? <BarList items={top_subcategories} /> : <Empty />}
        </Card>
      </div>

      <LatestOffersTable offers={latest_offers} total={kpis.total_offers} />
    </>
  );
}

function Empty() {
  return <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>No data for this region yet</div>;
}
