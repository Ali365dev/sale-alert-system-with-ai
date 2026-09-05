import { useMemo, useState } from "react";
import { useNavigate } from "react-router";

import { useOffers } from "../../api/offers";
import { CategoryCard } from "../../components/public/CategoryCard";
import { EmptyState } from "../../components/public/EmptyState";
import { PublicLayout } from "../../components/public/PublicLayout";
import { countBy, isExpired, isExpiringSoon } from "../../lib/publicOffers";
import { useSeo } from "../../lib/seo";

type Filter = "All Categories" | "Trending" | "Closing Soon";
const FILTERS: Filter[] = ["All Categories", "Trending", "Closing Soon"];

export function CategoriesPage() {
  useSeo({ title: "Browse Categories — DealPulse", description: "Browse every deal category on DealPulse." });
  const navigate = useNavigate();
  const { data, isLoading } = useOffers({ active: "true" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All Categories");

  const liveOffers = useMemo(() => (data?.offers ?? []).filter((o) => !isExpired(o)), [data]);
  const categoryCounts = useMemo(() => countBy(liveOffers, "category"), [liveOffers]);

  const closingSoonCategories = useMemo(() => {
    const withSoon = new Set(liveOffers.filter((o) => isExpiringSoon(o, 5)).map((o) => o.category).filter(Boolean));
    return new Set(withSoon as Set<string>);
  }, [liveOffers]);

  const visible = useMemo(() => {
    let list = categoryCounts;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (filter === "Closing Soon") {
      list = list.filter((c) => closingSoonCategories.has(c.name));
    }
    // countBy already sorts by count desc, which doubles as "Trending" order.
    return list;
  }, [categoryCounts, query, filter, closingSoonCategories]);

  return (
    <PublicLayout>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ margin: "0 0 6px", font: "var(--fw-extra) 26px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>Categories</h1>
        <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "var(--text-muted)" }}>{categoryCounts.length} categories with active offers.</p>

        <div style={{ position: "relative", marginBottom: 16, maxWidth: 420 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories…"
            style={{ width: "100%", height: 44, padding: "0 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-pill)", background: "var(--surface-card)", color: "var(--text-strong)", fontSize: 13.5 }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                height: 36,
                padding: "0 16px",
                borderRadius: "var(--radius-pill)",
                border: `1px solid ${filter === f ? "var(--brand)" : "var(--border)"}`,
                background: filter === f ? "var(--brand)" : "var(--surface-card)",
                color: filter === f ? "var(--on-brand)" : "var(--text-body)",
                fontWeight: 600,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="public-skeleton" style={{ height: 110, borderRadius: "var(--radius-lg)" }} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            title={query ? "No categories match your search" : "No categories yet"}
            description={query ? "Try a different search term." : "Categories appear here once offers are tracked."}
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14 }}>
            {visible.map((c) => (
              <CategoryCard key={c.name} name={c.name} offerCount={c.count} onClick={() => navigate(`/deals?category=${encodeURIComponent(c.name)}`)} />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
