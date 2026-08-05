import { Link } from "react-router";

import type { Offer } from "../../api/offers";
import { Icon } from "../icons";
import { Badge } from "../ui/Badge";
import { useFavoritesStore } from "../../store/favoritesStore";
import {
  copyToClipboard,
  discountLabel,
  expiryLabel,
  hostnameOf,
  humanize,
  isExpired,
  isExpiringSoon,
  isNewOffer,
  shareOffer,
} from "../../lib/publicOffers";
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
  const fresh = isNewOffer(offer);
  const { isFavorite, toggle } = useFavoritesStore();
  const favorite = isFavorite(offer.id);
  const discount = discountLabel(offer);
  const brandName = offer.brand ?? offer.company ?? "Unknown brand";
  const detailUrl = `${window.location.origin}/deals/${offer.id}`;

  return (
    <article
      className="public-offer-card public-fade-in"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "var(--surface-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding: 18,
        opacity: expired ? 0.6 : 1,
        position: "relative",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <BrandLogo name={brandName} />
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)" }}>{brandName}</div>
          {offer.category && <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{offer.category}</div>}
        </div>
        <button
          type="button"
          onClick={() => toggle(offer.id)}
          title={favorite ? "Remove from saved" : "Save offer"}
          style={{
            border: "none",
            background: "transparent",
            color: favorite ? "var(--danger)" : "var(--text-faint)",
            cursor: "pointer",
            padding: 2,
          }}
        >
          <Icon.heart size={18} fill={favorite ? "var(--danger)" : "none"} />
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {discount && <Badge tone="danger">{discount}</Badge>}
        {fresh && <Badge tone="ai">New</Badge>}
        {expiringSoon && !expired && <Badge tone="warning">Expiring soon</Badge>}
        {expired && <Badge tone="neutral">Expired</Badge>}
        {offer.verification_status === "verified" && (
          <Badge tone="success">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Icon.shield size={11} /> AI Verified
            </span>
          </Badge>
        )}
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

      {offer.coupon_code && (
        <button
          type="button"
          onClick={() => copyToClipboard(offer.coupon_code!, `Coupon "${offer.coupon_code}" copied.`)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            border: "1px dashed var(--border-strong)",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface-sunken)",
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          <span style={{ font: "700 13px/1 var(--font-mono)", color: "var(--text-strong)", letterSpacing: "var(--ls-wide)" }}>
            {offer.coupon_code}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color: "var(--brand)" }}>
            <Icon.copy size={13} /> Copy
          </span>
        </button>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11.5, color: "var(--text-faint)" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <Icon.calendar size={12} /> {expiryLabel(offer)}
        </span>
        {hostnameOf(offer.website) && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <Icon.store size={12} /> {hostnameOf(offer.website)}
          </span>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <Link
          to={`/deals/${offer.id}`}
          style={{
            flex: "1 1 auto",
            height: 38,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "var(--radius-sm)",
            background: "var(--brand)",
            color: "var(--on-brand)",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          View Deal
        </Link>
        <button
          type="button"
          onClick={() => shareOffer(offerTitle(offer), detailUrl)}
          title="Share"
          style={{
            width: 38,
            height: 38,
            flex: "0 0 auto",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            background: "var(--surface-card)",
            color: "var(--text-body)",
            cursor: "pointer",
          }}
        >
          <Icon.share size={15} />
        </button>
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
        gap: 12,
        background: "var(--surface-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 18,
        height: 320,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <div className="public-skeleton" style={{ width: 44, height: 44, borderRadius: "var(--radius-md)" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="public-skeleton" style={{ height: 12, width: "60%", borderRadius: 4 }} />
          <div className="public-skeleton" style={{ height: 10, width: "35%", borderRadius: 4 }} />
        </div>
      </div>
      <div className="public-skeleton" style={{ height: 20, width: "40%", borderRadius: "var(--radius-pill)" }} />
      <div className="public-skeleton" style={{ height: 16, width: "90%", borderRadius: 4 }} />
      <div className="public-skeleton" style={{ height: 32, width: "100%", borderRadius: "var(--radius-sm)" }} />
      <div className="public-skeleton" style={{ height: 38, width: "100%", borderRadius: "var(--radius-sm)", marginTop: "auto" }} />
    </div>
  );
}
