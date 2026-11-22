import type { ReactNode } from "react";
import { Link } from "react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

import type { Offer } from "../../../api/offers";
import { EmptyState } from "../EmptyState";
import { OfferCard, OfferCardSkeleton } from "../OfferCard";

export function HomeSection({
  id,
  icon: Icon,
  title,
  subtitle,
  viewAllHref,
  children,
}: {
  id: string;
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  viewAllHref?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="home-section" aria-labelledby={`${id}-title`}>
      <div className="home-section-head">
        <div>
          <h2 id={`${id}-title`}>
            {Icon && (
              <span className="home-section-icon">
                <Icon size={18} aria-hidden="true" />
              </span>
            )}
            {title}
          </h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {viewAllHref && (
          <Link to={viewAllHref} className="home-view-all">
            View all <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

export function DealGrid({ offers, loading, emptyText }: { offers: Offer[]; loading: boolean; emptyText: string }) {
  if (loading) {
    return (
      <div className="home-deal-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <OfferCardSkeleton key={i} />
        ))}
      </div>
    );
  }
  if (offers.length === 0) {
    return <EmptyState title="Nothing here yet" description={emptyText} action={<Link to="/deals" className="home-btn home-btn-primary">Browse all deals</Link>} />;
  }
  return (
    <div className="home-deal-grid">
      {offers.map((offer) => (
        <OfferCard key={offer.id} offer={offer} />
      ))}
    </div>
  );
}
