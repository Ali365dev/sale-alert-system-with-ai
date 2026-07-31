import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import type { Offer } from "../../api/offers";
import { useOffers } from "../../api/offers";
import { BrandCard } from "../../components/public/BrandCard";
import { CategoryCard } from "../../components/public/CategoryCard";
import { EmptyState } from "../../components/public/EmptyState";
import { OfferCard, OfferCardSkeleton } from "../../components/public/OfferCard";
import { PublicLayout } from "../../components/public/PublicLayout";
import { Icon } from "../../components/icons";
import { countBy, isExpiringSoon, isExpired } from "../../lib/publicOffers";
import { useSeo } from "../../lib/seo";

type SortKey = "newest" | "discount" | "expiring" | "popular";

const PAGE_SIZE = 12;

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

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: { label: string; href: string } }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--brand)" }}>
          {eyebrow}
        </div>
        <h2 style={{ margin: "4px 0 0", font: "var(--fw-bold) 24px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>{title}</h2>
      </div>
      {action && (
        <a href={action.href} style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>
          {action.label} →
        </a>
      )}
    </div>
  );
}

export function PublicOffers() {
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

  const featured = useMemo(
    () =>
      [...liveOffers]
        .filter((o) => o.discount_percentage != null)
        .sort((a, b) => (b.discount_percentage ?? 0) - (a.discount_percentage ?? 0))
        .slice(0, 8),
    [liveOffers],
  );

  const expiringSoon = useMemo(
    () =>
      liveOffers
        .filter((o) => isExpiringSoon(o, 5))
        .sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime())
        .slice(0, 8),
    [liveOffers],
  );

  const hasActiveFilters = Boolean(query || category || minDiscount || couponOnly || verifiedOnly);

  useSeo({
    title: "DealHub — Latest Offers, Discounts & Coupons",
    description: `Browse ${liveOffers.length}+ AI-verified deals, discounts, and coupon codes from your favorite brands.`,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: visible.slice(0, 10).map((o, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${window.location.origin}/deals/${o.id}`,
        name: o.brand ?? o.company ?? `Offer #${o.id}`,
      })),
    },
  });

  function setCategory(next: string) {
    const p = new URLSearchParams(params);
    if (next) p.set("category", next);
    else p.delete("category");
    setParams(p, { replace: true });
    setVisibleCount(PAGE_SIZE);
    document.getElementById("offers")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearFilters() {
    setParams({}, { replace: true });
    setMinDiscount(0);
    setCouponOnly(false);
    setVerifiedOnly(false);
    setSort("newest");
  }

  return (
    <PublicLayout>
      {/* Hero */}
      <section
        style={{
          background: "linear-gradient(160deg, var(--brand-subtle), var(--surface-app) 60%)",
          borderBottom: "1px solid var(--border)",
          padding: "64px 24px 56px",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: "var(--radius-pill)",
              background: "var(--surface-card)",
              border: "1px solid var(--border)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--brand)",
              marginBottom: 18,
            }}
          >
            <Icon.sparkle size={13} /> AI-verified deals, updated daily
          </span>
          <h1 style={{ margin: 0, font: "var(--fw-extra) 40px/1.15 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-strong)" }}>
            Find the best offers before they're gone
          </h1>
          <p style={{ margin: "14px 0 28px", fontSize: 16, lineHeight: 1.6, color: "var(--text-muted)" }}>
            {liveOffers.length} active deals across {brandCounts.length} brands — search, filter, and grab a coupon code in seconds.
          </p>

          <form
            onSubmit={(e) => e.preventDefault()}
            style={{ display: "flex", gap: 8, maxWidth: 520, margin: "0 auto" }}
          >
            <div style={{ position: "relative", flex: "1 1 auto" }}>
              <input
                value={query}
                onChange={(e) => {
                  const p = new URLSearchParams(params);
                  if (e.target.value) p.set("q", e.target.value);
                  else p.delete("q");
                  setParams(p, { replace: true });
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="Search brand, store, category, or coupon…"
                aria-label="Search offers"
                style={{
                  width: "100%",
                  height: 50,
                  padding: "0 16px 0 44px",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-pill)",
                  background: "var(--surface-card)",
                  color: "var(--text-strong)",
                  fontSize: 14,
                  boxShadow: "var(--shadow-sm)",
                }}
              />
              <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}>
                <Icon.search size={17} />
              </span>
            </div>
          </form>
        </div>
      </section>

      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "48px 24px 0" }}>
        {/* Featured carousel */}
        {featured.length > 0 && (
          <section style={{ marginBottom: 52 }}>
            <SectionHeading eyebrow="Handpicked" title="Featured offers" />
            <div className="public-scroll-row">
              {featured.map((o) => (
                <div key={o.id} style={{ width: 300 }}>
                  <OfferCard offer={o} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Trending brands */}
        {brandCounts.length > 0 && (
          <section id="brands" style={{ marginBottom: 52, scrollMarginTop: 84 }}>
            <SectionHeading eyebrow="Popular" title="Trending brands" />
            <div className="public-scroll-row">
              {brandCounts.slice(0, 10).map((b) => (
                <BrandCard key={b.name} name={b.name} offerCount={b.count} />
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        {categoryCounts.length > 0 && (
          <section id="categories" style={{ marginBottom: 52, scrollMarginTop: 84 }}>
            <SectionHeading eyebrow="Browse" title="Popular categories" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
              {categoryCounts.map((c) => (
                <CategoryCard key={c.name} name={c.name} offerCount={c.count} active={category === c.name} onClick={() => setCategory(category === c.name ? "" : c.name)} />
              ))}
            </div>
          </section>
        )}

        {/* Expiring soon */}
        {expiringSoon.length > 0 && (
          <section id="expiring" style={{ marginBottom: 52, scrollMarginTop: 84 }}>
            <SectionHeading eyebrow="Act fast" title="Expiring soon" />
            <div className="public-scroll-row">
              {expiringSoon.map((o) => (
                <div key={o.id} style={{ width: 300 }}>
                  <OfferCard offer={o} />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All offers + filters */}
        <section id="offers" style={{ marginBottom: 56, scrollMarginTop: 84 }}>
          <SectionHeading eyebrow={hasActiveFilters ? "Filtered" : "Fresh"} title={hasActiveFilters ? "Matching offers" : "Latest offers"} />

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
              onChange={(e) => setCategory(e.target.value)}
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

            <select
              value={minDiscount}
              onChange={(e) => setMinDiscount(Number(e.target.value))}
              style={selectStyle}
              aria-label="Minimum discount"
            >
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
        </section>
      </div>
    </PublicLayout>
  );
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
