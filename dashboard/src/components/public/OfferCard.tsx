import { useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, Clock3, Heart, Tag } from "lucide-react";

import type { Offer } from "../../api/offers";
import { useFavoritesStore } from "../../store/favoritesStore";
import {
  offerBlurb,
  offerCountdown,
  offerDiscountBadge,
  offerHeadline,
  offerImage,
  offerStoreName,
  offerStoreWebsite,
} from "../../lib/offerDisplay";
import { TONE_BG, TONE_FG, toneForName } from "../../lib/publicOffers";
import { BrandLogo } from "./BrandLogo";
import "./OfferCard.css";

function OfferMedia({ offer, store }: { offer: Offer; store: string | null }) {
  const [failed, setFailed] = useState(false);
  const [banner, setBanner] = useState(false);
  const src = offerImage(offer);
  const tone = toneForName(store ?? offer.category ?? "deal");

  if (src && !failed) {
    return (
      <img
        className={`offer-card-img${banner ? " is-banner" : ""}`}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        onLoad={(e) => {
          const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
          // Email artwork includes tracking pixels and thin header strips; cropping those to 4:3 shows nothing useful.
          if (w < 80 || h < 60) setFailed(true);
          else if (w / h > 2.2) setBanner(true);
        }}
      />
    );
  }

  // No usable artwork: a branded panel reads better than a repeated stock photo.
  return (
    <div className="offer-card-fallback" style={{ background: TONE_BG[tone], color: TONE_FG[tone] }} aria-hidden="true">
      {store ? <BrandLogo name={store} website={offerStoreWebsite(offer)} size={64} /> : <Tag size={40} strokeWidth={1.6} />}
      <span>{offer.offer_value ?? offer.category ?? "Exclusive deal"}</span>
    </div>
  );
}

export function OfferCard({ offer }: { offer: Offer }) {
  const { isFavorite, toggle } = useFavoritesStore();
  const favorite = isFavorite(offer.id);
  const store = offerStoreName(offer);
  const headline = offerHeadline(offer);
  const blurb = offerBlurb(offer);
  const badge = offerDiscountBadge(offer);
  const countdown = offerCountdown(offer);
  const href = `/deals/${offer.id}`;

  return (
    <article className={`offer-card public-fade-in${countdown.tone === "expired" ? " is-expired" : ""}`}>
      <div className="offer-card-media">
        <OfferMedia offer={offer} store={store} />
        {badge && <span className="offer-card-badge">{badge}</span>}
        <button
          type="button"
          className={`offer-card-fav${favorite ? " is-active" : ""}`}
          onClick={() => toggle(offer.id)}
          aria-label={favorite ? "Remove from favorites" : "Save to favorites"}
          aria-pressed={favorite}
        >
          <Heart size={16} fill={favorite ? "currentColor" : "none"} aria-hidden="true" />
        </button>
      </div>

      <div className="offer-card-body">
        <div className="offer-card-store">
          {store ? (
            <>
              <BrandLogo name={store} website={offerStoreWebsite(offer)} size={28} circle />
              <span>{store}</span>
            </>
          ) : (
            <>
              <span className="offer-card-store-icon"><Tag size={14} aria-hidden="true" /></span>
              <span>{offer.category ?? "Featured deal"}</span>
            </>
          )}
        </div>

        <h3 className="offer-card-title">
          <Link to={href} className="offer-card-link">{headline}</Link>
        </h3>
        {blurb && <p className="offer-card-blurb">{blurb}</p>}

        <div className="offer-card-footer">
          <span className={`offer-card-expiry tone-${countdown.tone}`}>
            <Clock3 size={13} aria-hidden="true" /> {countdown.label}
          </span>
          <span className="offer-card-cta" aria-hidden="true">
            View deal <ArrowUpRight size={14} />
          </span>
        </div>
      </div>
    </article>
  );
}

export function OfferCardSkeleton() {
  return (
    <div className="offer-card offer-card-skeleton" aria-hidden="true">
      <div className="public-skeleton offer-card-media" />
      <div className="offer-card-body">
        <div className="public-skeleton" style={{ height: 14, width: "45%", borderRadius: 4 }} />
        <div className="public-skeleton" style={{ height: 16, width: "90%", borderRadius: 4 }} />
        <div className="public-skeleton" style={{ height: 12, width: "70%", borderRadius: 4 }} />
        <div className="public-skeleton" style={{ height: 14, width: "40%", borderRadius: 4, marginTop: "auto" }} />
      </div>
    </div>
  );
}
