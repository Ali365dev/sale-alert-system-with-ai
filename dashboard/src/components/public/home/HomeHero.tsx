import { Link } from "react-router";
import { ArrowRight, BadgeCheck, Flame } from "lucide-react";

import type { Offer } from "../../../api/offers";
import { offerCountdown, offerDiscountBadge, offerHeadline, offerStoreName, offerStoreWebsite } from "../../../lib/offerDisplay";
import { BrandLogo } from "../BrandLogo";

function SpotlightRow({ offer }: { offer: Offer }) {
  const store = offerStoreName(offer) ?? "Featured deal";
  const badge = offerDiscountBadge(offer);
  return (
    <li>
      <Link to={`/deals/${offer.id}`} className="home-spotlight-row">
        <BrandLogo name={store} website={offerStoreWebsite(offer)} size={44} circle />
        <span className="home-spotlight-text">
          <span className="home-spotlight-store">{store}</span>
          <span className="home-spotlight-title">{offerHeadline(offer)}</span>
          <span className="home-spotlight-meta">{offerCountdown(offer).label}</span>
        </span>
        {badge && <span className="home-spotlight-badge">{badge}</span>}
      </Link>
    </li>
  );
}

export function HomeHero({
  offerCount,
  brandCount,
  maxDiscount,
  spotlight,
}: {
  offerCount: number;
  brandCount: number;
  maxDiscount: number;
  spotlight: Offer[];
}) {
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-container home-hero-grid">
        <div className="home-hero-copy">
          <span className="home-eyebrow-pill">
            <BadgeCheck size={14} aria-hidden="true" /> Deals today. A better tomorrow.
          </span>
          <h1 id="home-hero-title">
            Big brands.
            <br />
            <span>Bigger savings.</span>
          </h1>
          <p>Discover the best offers, promo codes and exclusive deals from your favorite brands — verified and updated every day.</p>
          <div className="home-hero-actions">
            <Link to="/deals" className="home-btn home-btn-primary">
              Explore deals <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to="/deals/brands" className="home-btn home-btn-ghost">
              Browse brands
            </Link>
          </div>
          <dl className="home-hero-stats">
            <div>
              <dt>Active offers</dt>
              <dd>{offerCount}+</dd>
            </div>
            <div>
              <dt>Brands tracked</dt>
              <dd>{brandCount}+</dd>
            </div>
            <div>
              <dt>Savings up to</dt>
              <dd className="is-accent">{maxDiscount}%</dd>
            </div>
          </dl>
        </div>

        {spotlight.length > 0 && (
          <aside className="home-spotlight" aria-labelledby="home-spotlight-title">
            <div className="home-spotlight-head">
              <span className="home-spotlight-flame"><Flame size={18} aria-hidden="true" /></span>
              <div>
                <h2 id="home-spotlight-title">Today’s top deals</h2>
                <p>Biggest discounts right now</p>
              </div>
            </div>
            <ul>
              {spotlight.map((offer) => (
                <SpotlightRow key={offer.id} offer={offer} />
              ))}
            </ul>
            <Link to="/deals" className="home-spotlight-all">
              See all deals <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </aside>
        )}
      </div>
    </section>
  );
}
