import { Link } from "react-router";

import type { Offer } from "../../api/offers";
import { Icon } from "../icons";
import { useFavoritesStore } from "../../store/favoritesStore";
import { discountLabel, expiryLabel, humanize, imageForOffer, isExpired, isExpiringSoon } from "../../lib/publicOffers";
import { sourceLabel, sourceTone } from "../../lib/offerSource";
import { Badge } from "../ui/Badge";
import { BrandLogo } from "./BrandLogo";

function offerTitle(offer: Offer): string {
  if (offer.summary) {
    const firstSentence = offer.summary.split(/(?<=[.!?])\s/)[0];
    if (firstSentence.length <= 90) return firstSentence;
    return `${firstSentence.slice(0, 87)}…`;
  }
  const type = humanize(offer.offer_type);
  const brand = offer.brand ?? offer.company ?? "Deal";
  return type ? `${brand} — ${type}` : `${brand} offer`;
}

export function OfferCard({ offer }: { offer: Offer }) {
  const expired = isExpired(offer);
  const expiringSoon = isExpiringSoon(offer);
  const { isFavorite, toggle } = useFavoritesStore();
  const favorite = isFavorite(offer.id);
  const discount = discountLabel(offer);
  const brandName = offer.brand ?? offer.company ?? "Unknown brand";

  return (
    <article
      className="public-offer-card public-fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        overflow: "hidden",
        opacity: expired ? 0.6 : 1,
        position: "relative",
      }}
    >
      <div style={{ position: "relative", aspectRatio: "16 / 9", background: "var(--surface-sunken)" }}>
        <img
          src={imageForOffer(offer.category, brandName)}
          alt=""
          aria-hidden
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
        {discount && (
          <span
            style={{
              position: "absolute",
              left: 10,
              top: 10,
              display: "inline-flex",
              alignItems: "center",
              height: 24,
              padding: "0 10px",
              borderRadius: "var(--radius-pill)",
              background: "var(--danger)",
              color: "#FFFFFF",
              font: "700 11.5px/1 var(--font-mono)",
              boxShadow: "var(--shadow-sm)",
            }}
          >
            {discount}
          </span>
        )}
        <button
          type="button"
          onClick={() => toggle(offer.id)}
          title={favorite ? "Remove from saved" : "Save offer"}
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 30,
            height: 30,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.92)",
            color: favorite ? "var(--danger)" : "var(--text-body)",
            cursor: "pointer",
          }}
        >
          <Icon.heart size={15} fill={favorite ? "var(--danger)" : "none"} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <BrandLogo name={brandName} size={32} />
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)", flex: "1 1 auto" }}>{brandName}</div>
          {sourceLabel(offer.source) && <Badge tone={sourceTone(offer.source)}>{sourceLabel(offer.source)}</Badge>}
        </div>

        <Link
          to={`/deals/${offer.id}`}
          style={{
            font: "var(--fw-semibold) 15px/1.35 var(--font-sans)",
            color: "var(--text-strong)",
            display: "block",
          }}
        >
          {offerTitle(offer)}
        </Link>

        {offer.summary && (
          <p
            style={{
              margin: 0,
              fontSize: 12.5,
              lineHeight: 1.55,
              color: "var(--text-muted)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {offer.summary}
          </p>
        )}

        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11.5,
            fontWeight: expired ? 700 : 400,
            color: expired ? "var(--danger)" : expiringSoon ? "var(--warning)" : "var(--text-faint)",
          }}
        >
          <Icon.clock size={12} /> {expiryLabel(offer)}
        </span>

        <Link
          to={`/deals/${offer.id}`}
          style={{
            marginTop: "auto",
            height: 40,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            borderRadius: "var(--radius-sm)",
            background: "var(--surface-inverse)",
            color: "var(--text-on-inverse)",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          View Deal <Icon.external size={13} />
        </Link>
      </div>
    </article>
  );
}

export function OfferCardSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        height: 320,
      }}
    >
      <div className="public-skeleton" style={{ aspectRatio: "16 / 9", borderRadius: 0 }} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, flex: 1 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div className="public-skeleton" style={{ width: 32, height: 32, borderRadius: "var(--radius-sm)" }} />
          <div className="public-skeleton" style={{ height: 12, width: "50%", borderRadius: 4 }} />
        </div>
        <div className="public-skeleton" style={{ height: 16, width: "90%", borderRadius: 4 }} />
        <div className="public-skeleton" style={{ height: 12, width: "60%", borderRadius: 4 }} />
        <div className="public-skeleton" style={{ height: 40, width: "100%", borderRadius: "var(--radius-sm)", marginTop: "auto" }} />
      </div>
    </div>
  );
}
