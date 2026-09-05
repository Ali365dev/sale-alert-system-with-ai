import { useMemo } from "react";
import { Link, useParams } from "react-router";

import { useOffers } from "../../api/offers";
import { useBrands } from "../../api/brands";
import { BrandLogo } from "../../components/public/BrandLogo";
import { EmptyState } from "../../components/public/EmptyState";
import { OfferCard, OfferCardSkeleton } from "../../components/public/OfferCard";
import { PublicLayout } from "../../components/public/PublicLayout";
import { Icon } from "../../components/icons";
import { hostnameOf, imageForOffer, isExpired } from "../../lib/publicOffers";
import { useSeo } from "../../lib/seo";

export function BrandDetailPage() {
  const { name } = useParams<{ name: string }>();
  const brandName = name ? decodeURIComponent(name) : "";

  const { data, isLoading } = useOffers({ brand: brandName, active: "true" });
  const { data: brandsData } = useBrands();
  const brandRecord = useMemo(() => brandsData?.brands.find((b) => b.name === brandName), [brandsData, brandName]);

  const offers = useMemo(() => (data?.offers ?? []).filter((o) => !isExpired(o)), [data]);

  useSeo({
    title: `${brandName} Offers & Coupons | DealPulse`,
    description: `${offers.length} active offer${offers.length === 1 ? "" : "s"} from ${brandName}. Discounts, coupon codes, and deals verified with AI.`,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: brandName,
      url: brandRecord?.website ?? undefined,
    },
  });

  return (
    <PublicLayout>
      <div style={{ maxWidth: 1240, margin: "0 auto", padding: "32px 24px 64px" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 20 }}>
          <Icon.chevron size={14} style={{ transform: "rotate(180deg)" }} /> Back to offers
        </Link>

        <div style={{ position: "relative", aspectRatio: "21 / 6", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: -40 }}>
          <img
            src={imageForOffer(brandRecord?.categories?.[0], brandName)}
            alt=""
            aria-hidden
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.35))" }} />
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 18,
            padding: 24,
            background: "var(--surface-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-sm)",
            marginBottom: 32,
            marginLeft: 16,
            marginRight: 16,
            flexWrap: "wrap",
          }}
        >
          <BrandLogo name={brandName} size={64} />
          <div style={{ flex: "1 1 auto", minWidth: 200 }}>
            <h1 style={{ margin: 0, font: "var(--fw-extra) 24px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>{brandName}</h1>
            <div style={{ marginTop: 6, display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: "var(--text-muted)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <Icon.offer size={13} /> {offers.length} active offer{offers.length === 1 ? "" : "s"}
              </span>
              {brandRecord?.categories?.[0] && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Icon.tag size={13} /> {brandRecord.categories.join(", ")}
                </span>
              )}
              {hostnameOf(brandRecord?.website ?? null) && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <Icon.store size={13} /> {hostnameOf(brandRecord?.website ?? null)}
                </span>
              )}
            </div>
          </div>
          {brandRecord?.website && (
            <a
              href={brandRecord.website}
              target="_blank"
              rel="noreferrer noopener"
              style={{
                height: 42,
                padding: "0 20px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                borderRadius: "var(--radius-sm)",
                background: "var(--brand)",
                color: "var(--on-brand)",
                fontWeight: 700,
                fontSize: 13.5,
              }}
            >
              Visit store <Icon.arrowRight size={14} />
            </a>
          )}
        </div>

        {isLoading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <OfferCardSkeleton key={i} />
            ))}
          </div>
        ) : offers.length === 0 ? (
          <EmptyState
            title="No active offers from this brand"
            description="Check back soon, or browse other brands and categories."
            action={
              <Link to="/" style={{ height: 38, padding: "0 18px", display: "inline-flex", alignItems: "center", borderRadius: "var(--radius-sm)", background: "var(--brand)", color: "var(--on-brand)", fontWeight: 700, fontSize: 13 }}>
                Browse all offers
              </Link>
            }
          />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
            {offers.map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
