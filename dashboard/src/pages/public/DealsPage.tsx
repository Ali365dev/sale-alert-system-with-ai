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
import "./DealsPage.css";

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

export function DealsPage() {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const [sort, setSort] = useState<SortKey>("newest");
  const [minDiscount, setMinDiscount] = useState(0);
  const [couponOnly, setCouponOnly] = useState(false);
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
      if (q) {
        const haystack = [o.brand, o.company, o.summary, o.coupon_code, o.category, o.subcategory]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [liveOffers, query, category, minDiscount, couponOnly]);

  const sorted = useMemo(() => sortOffers(filtered, sort, brandRank), [filtered, sort, brandRank]);
  const visible = sorted.slice(0, visibleCount);
  const activeFilterCount = [query, category, minDiscount, couponOnly].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  function clearFilters() {
    setParams({}, { replace: true });
    setMinDiscount(0);
    setCouponOnly(false);
    setSort("newest");
    setVisibleCount(PAGE_SIZE);
  }

  useSeo({
    title: category ? `${category} Deals — DealPulse` : "All Deals — DealPulse",
    description: `${liveOffers.length}+ active deals, discounts, and coupon codes from your favorite brands.`,
  });

  return (
    <PublicLayout>
      <div className="deals-page">
        <h1 className="deals-title">
          {category ? `${category} Deals` : "All Deals"}
        </h1>
        <p className="deals-subtitle">
          {liveOffers.length} active offer{liveOffers.length === 1 ? "" : "s"} across {brandCounts.length} brands.
        </p>

        <div className="deals-filters" role="search" aria-label="Filter deals">
          <span className="deals-filters-label">
            <Icon.filter size={15} aria-hidden="true" /> Filters
            {activeFilterCount > 0 && <span className="deals-filters-count">{activeFilterCount}</span>}
          </span>

          <select
            className="deals-select"
            value={category}
            onChange={(e) => {
              const p = new URLSearchParams(params);
              if (e.target.value) p.set("category", e.target.value);
              else p.delete("category");
              setParams(p, { replace: true });
              setVisibleCount(PAGE_SIZE);
            }}
            aria-label="Filter by category"
          >
            <option value="">All categories</option>
            {categoryCounts.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>

          <select
            className="deals-select"
            value={minDiscount}
            onChange={(e) => { setMinDiscount(Number(e.target.value)); setVisibleCount(PAGE_SIZE); }}
            aria-label="Minimum discount"
          >
            {MIN_DISCOUNTS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          <select className="deals-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort by">
            <option value="newest">Newest</option>
            <option value="discount">Highest discount</option>
            <option value="expiring">Expiring soon</option>
            <option value="popular">Most popular</option>
          </select>

          <label className="deals-check">
            <input
              type="checkbox"
              checked={couponOnly}
              onChange={(e) => { setCouponOnly(e.target.checked); setVisibleCount(PAGE_SIZE); }}
            />
            Coupon available
          </label>

          {hasActiveFilters && (
            <button type="button" className="deals-clear" onClick={clearFilters}>
              <Icon.x size={14} aria-hidden="true" /> Clear all
            </button>
          )}
        </div>

        <p className="deals-result-count" aria-live="polite">
          {isLoading ? "Loading deals…" : hasActiveFilters
            ? `${sorted.length} of ${liveOffers.length} deals match`
            : `Showing ${Math.min(visibleCount, sorted.length)} of ${sorted.length} deals`}
        </p>

        {isLoading ? (
          <div className="deals-grid">
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
                  className="deals-empty-btn"
                >
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="deals-grid">
              {visible.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </div>
            {visibleCount < sorted.length && (
              <div className="deals-more">
                <button type="button" className="deals-more-btn" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
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
