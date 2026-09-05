import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";

import { useOffers } from "../../api/offers";
import { EmptyState } from "../../components/public/EmptyState";
import { OfferCard, OfferCardSkeleton } from "../../components/public/OfferCard";
import { PublicLayout } from "../../components/public/PublicLayout";
import { Icon } from "../../components/icons";
import { countBy, isExpired } from "../../lib/publicOffers";
import { useSeo } from "../../lib/seo";

const PAGE_SIZE = 12;
const DISCOUNT_TIERS = [20, 50, 70];
const SORTS = [
  { key: "discount", label: "Highest Discount" },
  { key: "newest", label: "Newest" },
  { key: "expiring", label: "Expiring Soonest" },
] as const;
type SortKey = (typeof SORTS)[number]["key"];

export function SearchPage() {
  useSeo({ title: "Search Deals — DealPulse" });
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [minDiscount, setMinDiscount] = useState<number | null>(null);
  const [sort, setSort] = useState<SortKey>("discount");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data, isLoading } = useOffers({ active: "true" });
  const liveOffers = useMemo(() => (data?.offers ?? []).filter((o) => !isExpired(o)), [data]);
  const categoryCounts = useMemo(() => countBy(liveOffers, "category"), [liveOffers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = liveOffers.filter((o) => {
      if (selectedCategory && o.category !== selectedCategory) return false;
      if (minDiscount && (o.discount_percentage ?? 0) < minDiscount) return false;
      if (q) {
        const haystack = [o.brand, o.company, o.summary, o.coupon_code, o.category, o.subcategory].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    if (sort === "discount") list = [...list].sort((a, b) => (b.discount_percentage ?? 0) - (a.discount_percentage ?? 0));
    else if (sort === "newest") list = [...list].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    else list = [...list].sort((a, b) => new Date(a.expiry_date ?? "9999").getTime() - new Date(b.expiry_date ?? "9999").getTime());
    return list;
  }, [liveOffers, query, selectedCategory, minDiscount, sort]);

  const showFilters = query.trim().length === 0 && !selectedCategory && !minDiscount;
  const visible = filtered.slice(0, visibleCount);

  function updateQuery(value: string) {
    setQuery(value);
    setVisibleCount(PAGE_SIZE);
    const p = new URLSearchParams(params);
    if (value) p.set("q", value);
    else p.delete("q");
    setParams(p, { replace: true });
  }

  return (
    <PublicLayout>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 64px" }}>
        <h1 style={{ margin: "0 0 18px", font: "var(--fw-extra) 26px/1.2 var(--font-sans)", color: "var(--text-strong)", textAlign: "center" }}>
          Search Deals
        </h1>

        <div style={{ position: "relative", marginBottom: 24 }}>
          <input
            autoFocus
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder="Search deals, brands, categories…"
            aria-label="Search deals"
            style={{
              width: "100%",
              height: 52,
              padding: "0 18px 0 46px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-pill)",
              background: "var(--surface-card)",
              color: "var(--text-strong)",
              fontSize: 15,
              boxShadow: "var(--shadow-sm)",
            }}
          />
          <span style={{ position: "absolute", left: 18, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }}>
            <Icon.search size={18} />
          </span>
        </div>

        {showFilters ? (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-faint)" }}>
                Categories
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 26 }}>
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                style={{
                  height: 34,
                  padding: "0 14px",
                  borderRadius: "var(--radius-pill)",
                  border: `1.5px solid ${!selectedCategory ? "var(--brand)" : "var(--border)"}`,
                  background: !selectedCategory ? "var(--brand)" : "var(--surface-card)",
                  color: !selectedCategory ? "var(--on-brand)" : "var(--text-body)",
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: "pointer",
                }}
              >
                All
              </button>
              {categoryCounts.slice(0, 10).map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setSelectedCategory(selectedCategory === c.name ? null : c.name)}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    borderRadius: "var(--radius-pill)",
                    border: `1.5px solid ${selectedCategory === c.name ? "var(--brand)" : "var(--border)"}`,
                    background: selectedCategory === c.name ? "var(--brand)" : "var(--surface-card)",
                    color: selectedCategory === c.name ? "var(--on-brand)" : "var(--text-body)",
                    fontWeight: 600,
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>

            <span style={{ display: "block", marginBottom: 10, fontSize: 12, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-faint)" }}>
              Discount Range
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 26 }}>
              {DISCOUNT_TIERS.map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setMinDiscount(minDiscount === tier ? null : tier)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 4,
                    padding: "14px 8px",
                    borderRadius: "var(--radius-lg)",
                    border: `1.5px solid ${minDiscount === tier ? "var(--brand)" : "var(--border)"}`,
                    background: "var(--surface-card)",
                    cursor: "pointer",
                  }}
                >
                  <Icon.tag size={16} style={{ color: "var(--brand)" }} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>{tier}%+</span>
                  <span style={{ fontSize: 11, color: "var(--text-faint)" }}>Deals</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              {filtered.length} result{filtered.length === 1 ? "" : "s"}
              {selectedCategory && ` in ${selectedCategory}`}
            </span>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {(selectedCategory || minDiscount || query) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategory(null);
                    setMinDiscount(null);
                    updateQuery("");
                  }}
                  style={{ border: "none", background: "none", color: "var(--brand)", fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
                >
                  Clear
                </button>
              )}
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                style={{ height: 34, padding: "0 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface-card)", color: "var(--text-strong)", fontSize: 12.5 }}
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    Sort: {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {!showFilters &&
          (isLoading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <OfferCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No results" description="Try a different search term or clear your filters." />
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                {visible.map((o) => (
                  <OfferCard key={o.id} offer={o} />
                ))}
              </div>
              {visibleCount < filtered.length && (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    style={{ height: 42, padding: "0 22px", border: "1px solid var(--border)", borderRadius: "var(--radius-pill)", background: "var(--surface-card)", color: "var(--text-strong)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >
                    Load more ({filtered.length - visibleCount} more)
                  </button>
                </div>
              )}
            </>
          ))}
      </div>
    </PublicLayout>
  );
}
