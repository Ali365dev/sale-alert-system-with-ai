import { useMemo } from "react";
import { Link, useParams } from "react-router";

import { useOffer, useOffers } from "../../api/offers";
import { BrandLogo } from "../../components/public/BrandLogo";
import { EmptyState } from "../../components/public/EmptyState";
import { OfferCard, OfferCardSkeleton } from "../../components/public/OfferCard";
import { PublicLayout } from "../../components/public/PublicLayout";
import { Icon } from "../../components/icons";
import { Badge } from "../../components/ui/Badge";
import {
  copyToClipboard,
  discountLabel,
  expiryLabel,
  hostnameOf,
  humanize,
  imageForOffer,
  isExpired,
  shareOffer,
} from "../../lib/publicOffers";
import { sourceLabel, sourceTone } from "../../lib/offerSource";
import { useSeo } from "../../lib/seo";

export function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const offerId = id ? Number(id) : null;
  const { data: offer, isLoading, isError } = useOffer(offerId);
  const { data: allOffers } = useOffers({ active: "true" });

  const brandName = offer?.brand ?? offer?.company ?? null;

  const similarOffers = useMemo(() => {
    if (!offer || !allOffers) return [];
    return allOffers.offers
      .filter((o) => o.id !== offer.id && !isExpired(o) && (o.category === offer.category || o.brand === offer.brand))
      .slice(0, 4);
  }, [offer, allOffers]);

  const relatedBrands = useMemo(() => {
    if (!offer || !allOffers) return [];
    const names = new Set<string>();
    for (const o of allOffers.offers) {
      if (o.category === offer.category && o.brand && o.brand !== offer.brand) names.add(o.brand);
    }
    return Array.from(names).slice(0, 6);
  }, [offer, allOffers]);

  const title = offer ? `${brandName ?? "Offer"} — ${discountLabel(offer) ?? humanize(offer.offer_type) ?? "Deal"}` : "Offer";

  useSeo({
    title: offer ? `${title} | DealPulse` : "Offer | DealPulse",
    description: offer ? offer.summary ?? `${discountLabel(offer) ?? "Special"} deal from ${brandName ?? "this brand"}.` : undefined,
    type: "product",
    structuredData:
      offer && brandName
        ? {
            "@context": "https://schema.org",
            "@type": "Offer",
            name: title,
            description: offer.summary ?? undefined,
            url: window.location.href,
            priceValidUntil: offer.expiry_date ?? undefined,
            seller: { "@type": "Organization", name: brandName },
          }
        : undefined,
  });

  if (isLoading) {
    return (
      <PublicLayout>
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
          <OfferCardSkeleton />
        </div>
      </PublicLayout>
    );
  }

  if (isError || !offer) {
    return (
      <PublicLayout>
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "56px 24px" }}>
          <EmptyState
            title="Offer not found"
            description="This offer may have expired or been removed."
            action={
              <Link to="/" style={{ height: 38, padding: "0 18px", display: "inline-flex", alignItems: "center", borderRadius: "var(--radius-sm)", background: "var(--brand)", color: "var(--on-brand)", fontWeight: 700, fontSize: 13 }}>
                Back to offers
              </Link>
            }
          />
        </div>
      </PublicLayout>
    );
  }

  const expired = isExpired(offer);
  const discount = discountLabel(offer);
  const currentUrl = window.location.href;

  return (
    <PublicLayout>
      <div style={{ maxWidth: 980, margin: "0 auto", padding: "32px 24px 64px" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 20 }}>
          <Icon.chevron size={14} style={{ transform: "rotate(180deg)" }} /> Back to offers
        </Link>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 28 }} className="offer-detail-grid">
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: "var(--radius-lg)", overflow: "hidden", opacity: expired ? 0.7 : 1 }}>
              <img src={imageForOffer(offer.category, brandName)} alt="" aria-hidden style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              {discount && (
                <span
                  style={{
                    position: "absolute",
                    left: 14,
                    bottom: 14,
                    display: "inline-flex",
                    alignItems: "center",
                    height: 30,
                    padding: "0 14px",
                    borderRadius: "var(--radius-pill)",
                    background: "var(--danger)",
                    color: "#FFFFFF",
                    font: "700 13.5px/1 var(--font-mono)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  {discount}
                </span>
              )}
            </div>

            <div
              style={{
                background: "var(--surface-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-sm)",
                padding: 28,
                display: "flex",
                flexDirection: "column",
                gap: 18,
                opacity: expired ? 0.7 : 1,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <BrandLogo name={brandName ?? "?"} size={56} />
                <div>
                  <div style={{ font: "var(--fw-bold) 18px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>{brandName ?? "Unknown brand"}</div>
                  {offer.category && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{offer.category}{offer.subcategory ? ` · ${offer.subcategory}` : ""}</div>}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {discount && <Badge tone="danger">{discount}</Badge>}
                {expired && <Badge tone="neutral">Expired</Badge>}
                {offer.verification_status === "verified" && (
                  <Badge tone="success">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      <Icon.shield size={11} /> AI Verified ({offer.verification_confidence}% confidence)
                    </span>
                  </Badge>
                )}
                {offer.offer_type && <Badge tone="brand">{humanize(offer.offer_type)}</Badge>}
                {sourceLabel(offer.source) && <Badge tone={sourceTone(offer.source)}>{sourceLabel(offer.source)}</Badge>}
              </div>

              <h1 style={{ margin: 0, font: "var(--fw-bold) 24px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>{title}</h1>

              {offer.summary && <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.7, color: "var(--text-body)" }}>{offer.summary}</p>}

              {offer.key_highlights.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 8 }}>
                    Key highlights
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, color: "var(--text-body)" }}>
                    {offer.key_highlights.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              {offer.coupon_code && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 8 }}>
                    Coupon code
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(offer.coupon_code!, `Coupon "${offer.coupon_code}" copied.`)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      width: "100%",
                      border: "1.5px dashed var(--border-strong)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--surface-sunken)",
                      padding: "14px 18px",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ font: "800 17px/1 var(--font-mono)", color: "var(--text-strong)", letterSpacing: "var(--ls-wide)" }}>{offer.coupon_code}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "var(--brand)" }}>
                      <Icon.copy size={14} /> Copy code
                    </span>
                  </button>
                </div>
              )}

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 8 }}>
                  Terms &amp; conditions
                </div>
                <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.6, color: "var(--text-muted)" }}>
                  {expiryLabel(offer)}. Offer terms are set by {brandName ?? "the retailer"} and may change without notice — confirm final pricing and
                  eligibility at checkout on their site.
                </p>
              </div>
            </div>
          </div>

          <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                background: "var(--surface-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                boxShadow: "var(--shadow-sm)",
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
                <Icon.calendar size={14} /> {expiryLabel(offer)}
              </div>
              {hostnameOf(offer.website) && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
                  <Icon.store size={14} /> {hostnameOf(offer.website)}
                </div>
              )}

              {offer.website && !expired ? (
                <a
                  href={offer.website}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{
                    height: 46,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    borderRadius: "var(--radius-sm)",
                    background: "var(--brand)",
                    color: "var(--on-brand)",
                    fontWeight: 700,
                    fontSize: 14,
                    boxShadow: "var(--shadow-brand)",
                  }}
                >
                  Visit store <Icon.arrowRight size={15} />
                </a>
              ) : (
                <div style={{ height: 46, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)", color: "var(--text-faint)", fontWeight: 700, fontSize: 13 }}>
                  {expired ? "Offer expired" : "Store link unavailable"}
                </div>
              )}

              <button
                type="button"
                onClick={() => shareOffer(title, currentUrl)}
                style={{
                  height: 40,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  background: "var(--surface-app)",
                  color: "var(--text-strong)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                <Icon.share size={14} /> Share this deal
              </button>
            </div>

            {relatedBrands.length > 0 && (
              <div
                style={{
                  background: "var(--surface-card)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-faint)" }}>
                  Related brands
                </div>
                {relatedBrands.map((b) => (
                  <Link key={b} to={`/deals/brand/${encodeURIComponent(b)}`} style={{ fontSize: 13, color: "var(--text-body)", fontWeight: 600 }}>
                    {b}
                  </Link>
                ))}
              </div>
            )}
          </aside>
        </div>

        {similarOffers.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ font: "var(--fw-bold) 20px/1.2 var(--font-sans)", color: "var(--text-strong)", marginBottom: 18 }}>Similar offers</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 18 }}>
              {similarOffers.map((o) => (
                <OfferCard key={o.id} offer={o} />
              ))}
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
