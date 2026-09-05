import { useMemo } from "react";
import { Link } from "react-router";

import { useOffers } from "../../api/offers";
import { EmptyState } from "../../components/public/EmptyState";
import { OfferCard, OfferCardSkeleton } from "../../components/public/OfferCard";
import { PublicLayout } from "../../components/public/PublicLayout";
import { useSeo } from "../../lib/seo";
import { useFavoritesStore } from "../../store/favoritesStore";

export function FavoritesPage() {
  useSeo({ title: "Favorites — DealPulse", description: "Offers you've saved." });
  const { ids } = useFavoritesStore();
  const { data, isLoading } = useOffers({ active: "true" });

  const favorites = useMemo(() => (data?.offers ?? []).filter((o) => ids.has(o.id)), [data, ids]);

  return (
    <PublicLayout>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px 64px" }}>
        <h1 style={{ margin: "0 0 22px", font: "var(--fw-extra) 26px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>Favorites</h1>

        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <OfferCardSkeleton key={i} />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <EmptyState
            title="No favorites yet"
            description="Tap the heart on any deal to save it here for quick access later."
            action={
              <Link to="/" style={{ height: 38, padding: "0 18px", display: "inline-flex", alignItems: "center", borderRadius: "var(--radius-sm)", background: "var(--brand)", color: "var(--on-brand)", fontWeight: 700, fontSize: 13 }}>
                Browse offers
              </Link>
            }
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
            {favorites.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
