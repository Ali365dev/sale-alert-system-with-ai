import { useMemo, useState } from "react";

import { useCreateBrandRequest } from "../../api/brandRequests";
import type { Brand } from "../../api/brands";
import { useBrands } from "../../api/brands";
import { useOffers } from "../../api/offers";
import { BrandCard } from "../../components/public/BrandCard";
import { EmptyState } from "../../components/public/EmptyState";
import { Button } from "../../components/ui/Button";
import { Label, TextArea, TextInput } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { PublicLayout } from "../../components/public/PublicLayout";
import { Icon } from "../../components/icons";
import { countBy, isExpired, isExpiringSoon } from "../../lib/publicOffers";
import { useSeo } from "../../lib/seo";
import { toast } from "../../store/toastStore";

type Filter = "All" | "Trending" | "Newly Added" | "Expiring Soon";
const FILTERS: Filter[] = ["All", "Trending", "Newly Added", "Expiring Soon"];

function RequestBrandForm({ initialName, onDone }: { initialName: string; onDone: () => void }) {
  const createRequest = useCreateBrandRequest();
  const [name, setName] = useState(initialName);
  const [note, setNote] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <Label>Brand name</Label>
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Acme Corp" />
      </div>
      <div>
        <Label>Why do you want to see this brand? (optional)</Label>
        <TextArea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tell us a bit more…" />
      </div>
      <Button
        loading={createRequest.isPending}
        disabled={!name.trim()}
        onClick={() => {
          createRequest.mutate(
            { brand_name: name.trim(), note: note.trim() || null },
            {
              onSuccess: () => {
                toast.success(`Thanks! We've added "${name.trim()}" to our wishlist.`);
                onDone();
              },
              onError: () => toast.error("Couldn't send your request. Please try again."),
            },
          );
        }}
      >
        Submit request
      </Button>
    </div>
  );
}

export function BrandsPage() {
  useSeo({ title: "Browse Brands — DealPulse", description: "Every brand tracked on DealPulse, with active offers front and center." });
  const { data: brandsData, isLoading: brandsLoading } = useBrands();
  const { data: offersData, isLoading: offersLoading } = useOffers({ active: "true" });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("All");
  const [requestOpen, setRequestOpen] = useState(false);

  const liveOffers = useMemo(() => (offersData?.offers ?? []).filter((o) => !isExpired(o)), [offersData]);
  const offerCountByBrand = useMemo(() => new Map(countBy(liveOffers, "brand").map((b) => [b.name, b.count])), [liveOffers]);

  const isNewBrand = (name: string) =>
    liveOffers.some((o) => o.brand === name && o.created_at && (Date.now() - new Date(o.created_at).getTime()) / 86400000 <= 3);
  const isExpiringSoonBrand = (name: string) => liveOffers.some((o) => o.brand === name && isExpiringSoon(o, 7));

  const brands: Brand[] = brandsData?.brands ?? [];

  const filtered = useMemo(() => {
    let list = brands;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((b) => b.name.toLowerCase().includes(q));
    }
    if (filter === "Trending") list = list.filter((b) => (offerCountByBrand.get(b.name) ?? 0) > 0);
    else if (filter === "Newly Added") list = list.filter((b) => isNewBrand(b.name));
    else if (filter === "Expiring Soon") list = list.filter((b) => isExpiringSoonBrand(b.name));

    return [...list].sort((a, b) => {
      const ca = offerCountByBrand.get(a.name) ?? 0;
      const cb = offerCountByBrand.get(b.name) ?? 0;
      return cb - ca || a.name.localeCompare(b.name);
      // Brands with the most active offers lead, matching dealplusApp's
      // BrandListScreen sort (src/screens/deals/BrandListScreen.js).
    });
    // isNewBrand/isExpiringSoonBrand close over liveOffers (already a dep
    // via offerCountByBrand's own liveOffers-derived recompute) — omitted
    // here since they're plain functions recreated every render, not memoized
    // state, so eslint can't see their real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brands, query, filter, offerCountByBrand]);

  const isLoading = brandsLoading || offersLoading;

  return (
    <PublicLayout>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ margin: "0 0 6px", font: "var(--fw-extra) 26px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>Brands</h1>
        <p style={{ margin: "0 0 22px", fontSize: 13.5, color: "var(--text-muted)" }}>{brands.length} brands tracked on DealPulse.</p>

        <div style={{ position: "relative", marginBottom: 16, maxWidth: 420 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search brands…"
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="public-skeleton" style={{ height: 76, borderRadius: "var(--radius-lg)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={query ? `No brands match "${query}"` : "No brands match this filter"}
            description="Can't find what you're looking for? Let us know and we'll look into adding it."
            action={
              <Button onClick={() => setRequestOpen(true)}>
                <Icon.arrowRight size={14} /> Request "{query.trim() || "a brand"}"
              </Button>
            }
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
            {filtered.map((b) => (
              <BrandCard key={b.id} name={b.name} offerCount={offerCountByBrand.get(b.name) ?? 0} category={b.categories?.[0]} />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", marginTop: 32 }}>
            <button
              type="button"
              onClick={() => setRequestOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "none", background: "none", color: "var(--brand)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              <Icon.sparkle size={14} /> Can't find a brand? Request it
            </button>
          </div>
        )}
      </div>

      {requestOpen && (
        <Modal title="Request a brand" onClose={() => setRequestOpen(false)}>
          <RequestBrandForm initialName={query.trim()} onDone={() => setRequestOpen(false)} />
        </Modal>
      )}
    </PublicLayout>
  );
}
