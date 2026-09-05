import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { Offer } from "../../api/offers";
import { useOffers } from "../../api/offers";
import { EmptyState } from "../../components/public/EmptyState";
import { OfferCard, OfferCardSkeleton } from "../../components/public/OfferCard";
import { PublicLayout } from "../../components/public/PublicLayout";
import { Icon } from "../../components/icons";
import { countBy, isExpired } from "../../lib/publicOffers";
import { useSeo } from "../../lib/seo";

const PAGE_SIZE = 12;

type SortKey = "newest" | "discount" | "expiring" | "popular";

const MIN_DISCOUNTS = [
  { label: "Any discount", value: 0 },
  { label: "10% or more", value: 10 },
  { label: "25% or more", value: 25 },
  { label: "50% or more", value: 50 },
  { label: "70% or more", value: 70 },
];

function sortOffers(offers: Offer[], sort: SortKey, brandRank: Map<string, number>): Offer[] {
  const copy = [...offers];
  switch (sort) {
    case "discount":
      return copy.sort((a, b) => (b.discount_percentage ?? -1) - (a.discount_percentage ?? -1));
    case "expiring":
      return copy.sort((a, b) => {
        const ea = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
        const eb = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
        return ea - eb;
      });
    case "popular":
      return copy.sort((a, b) => {
        const verifiedDiff = Number(b.verification_status === "verified") - Number(a.verification_status === "verified");
        if (verifiedDiff !== 0) return verifiedDiff;
        return (brandRank.get(b.brand ?? "") ?? 0) - (brandRank.get(a.brand ?? "") ?? 0);
      });
    case "newest":
    default:
      return copy.sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  }
}

const selectStyle: React.CSSProperties = {
  height: 36,
  padding: "0 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-app)",
  color: "var(--text-strong)",
  fontSize: 12.5,
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  fontSize: 12.5,
  color: "var(--text-body)",
  cursor: "pointer",
};

export function DealsPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const [sort, setSort] = useState<SortKey>("newest");
  const [minDiscount, setMinDiscount] = useState(0);
  const [couponOnly, setCouponOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data, isLoading } = useOffers({ active: "true" });
  const offers = useMemo(() => data?.offers ?? [], [data]);
  const liveOffers = useMemo(() => offers.filter((o) => !isExpired(o)), [offers]);

  const brandCounts = useMemo(() => countBy(liveOffers, "brand"), [liveOffers]);
  const categoryCounts = useMemo(() => countBy(liveOffers, "category"), [liveOffers]);
  const brandRank = useMemo(() => new Map(brandCounts.map((b) => [b.name, b.count])), [brandCounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return liveOffers.filter((o) => {
      if (category && o.category !== category) return false;
      if (minDiscount > 0 && (o.discount_percentage ?? 0) < minDiscount) return false;
      if (couponOnly && !o.coupon_code) return false;
      if (verifiedOnly && o.verification_status !== "verified") return false;
      if (q) {
        const haystack = [o.brand, o.company, o.summary, o.coupon_code, o.category, o.subcategory]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [liveOffers, query, category, minDiscount, couponOnly, verifiedOnly]);

  const sorted = useMemo(() => sortOffers(filtered, sort, brandRank), [filtered, sort, brandRank]);
  const visible = sorted.slice(0, visibleCount);
  const hasActiveFilters = Boolean(query || category || minDiscount || couponOnly || verifiedOnly);

  function clearFilters() {
    setParams({}, { replace: true });
    setMinDiscount(0);
    setCouponOnly(false);
    setVerifiedOnly(false);
    setSort("newest");
    setVisibleCount(PAGE_SIZE);
  }

  useSeo({
    title: category ? `${category} Deals — DealPulse` : "All Deals — DealPulse",
    description: `${liveOffers.length}+ active deals, discounts, and coupon codes from your favorite brands.`,
  });

  return (
    <PublicLayout>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ margin: "0 0 6px", font: "var(--fw-extra) 26px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>
          {category ? `${category} Deals` : "All Deals"}
        </h1>
        <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "var(--text-muted)" }}>
          {liveOffers.length} active offer{liveOffers.length === 1 ? "" : "s"} across {brandCounts.length} brands.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            padding: 14,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--surface-card)",
            marginBottom: 22,
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>
            <Icon.filter size={14} /> Filters
          </span>

          <select
            value={category}
            onChange={(e) => {
              const p = new URLSearchParams(params);
              if (e.target.value) p.set("category", e.target.value);
              else p.delete("category");
              setParams(p, { replace: true });
              setVisibleCount(PAGE_SIZE);
            }}
            style={selectStyle}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categoryCounts.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          <select value={minDiscount} onChange={(e) => setMinDiscount(Number(e.target.value))} style={selectStyle} aria-label="Minimum discount">
            {MIN_DISCOUNTS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={selectStyle} aria-label="Sort by">
            <option value="newest">Newest</option>
            <option value="discount">Highest discount</option>
            <option value="expiring">Expiring soon</option>
            <option value="popular">Most popular</option>
          </select>

          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={couponOnly} onChange={(e) => setCouponOnly(e.target.checked)} /> Coupon available
          </label>
          <label style={checkboxLabelStyle}>
            <input type="checkbox" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} /> AI verified
          </label>

          {hasActiveFilters && (
            <button type="button" onClick={clearFilters} style={{ marginLeft: "auto", border: "none", background: "transparent", color: "var(--brand)", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              Clear filters
            </button>
          )}
        </div>

        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <OfferCardSkeleton key={i} />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? "No offers match your filters" : "No offers yet"}
            description={
              hasActiveFilters
                ? "Try widening your search — clear a filter or search a different brand or category."
                : "Check back soon — new deals are added regularly."
            }
            action={
              hasActiveFilters ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{ height: 38, padding: "0 18px", border: "none", borderRadius: "var(--radius-sm)", background: "var(--brand)", color: "var(--on-brand)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
              {visible.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </div>
            {visibleCount < sorted.length && (
              <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  style={{
                    height: 44,
                    padding: "0 24px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-pill)",
                    background: "var(--surface-card)",
                    color: "var(--text-strong)",
                    fontWeight: 700,
                    fontSize: 13.5,
                    cursor: "pointer",
                  }}
                >
                  Load more ({sorted.length - visibleCount} more)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PublicLayout>
  );
}
