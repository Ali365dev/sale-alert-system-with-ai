import { useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Bell, CalendarDays, Mail, ShieldCheck, Store } from "lucide-react";

import { toast } from "../../../store/toastStore";
import { BrandLogo } from "../BrandLogo";

export function TrendingBrands({ brands }: { brands: { name: string; count: number }[] }) {
  return (
    <ul className="home-brand-strip">
      {brands.map((b) => (
        <li key={b.name}>
          <Link to={`/deals/brand/${encodeURIComponent(b.name)}`} className="home-brand-chip">
            <BrandLogo name={b.name} size={56} circle />
            <span className="home-brand-name">{b.name}</span>
            {b.count > 0 && <span className="home-brand-count">{b.count} {b.count === 1 ? "deal" : "deals"}</span>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function FollowBanner({ brands }: { brands: string[] }) {
  return (
    <section className="home-follow" aria-labelledby="home-follow-title">
      <div className="home-follow-copy">
        <span className="home-eyebrow-pill is-inverse">
          <Bell size={14} aria-hidden="true" /> Instant alerts
        </span>
        <h2 id="home-follow-title">Get notified the moment your favorite brands drop a deal.</h2>
        <p>Follow brands and we’ll ping you when new offers go live — no inbox digging required.</p>
        <Link to="/sign-in" className="home-btn home-btn-light">
          Follow brands <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <div className="home-follow-visual" aria-hidden="true">
        <div className="home-follow-notif">
          <span className="home-follow-bell"><Bell size={18} /></span>
          <span>
            <strong>New deal from {brands[0] ?? "your brands"}</strong>
            <small>Just now · Tap to view</small>
          </span>
        </div>
        <div className="home-follow-logos">
          {brands.slice(0, 4).map((name) => (
            <BrandLogo key={name} name={name} size={52} circle />
          ))}
        </div>
      </div>
    </section>
  );
}

export function NewsletterBand() {
  const [email, setEmail] = useState("");
  return (
    <section className="home-newsletter" aria-labelledby="home-newsletter-title">
      <span className="home-newsletter-icon"><Mail size={22} aria-hidden="true" /></span>
      <div className="home-newsletter-copy">
        <h2 id="home-newsletter-title">Get the best deals in your inbox</h2>
        <p>New offers, exclusive discounts and top brands — once a week. No spam, unsubscribe anytime.</p>
      </div>
      <form
        className="home-newsletter-form"
        onSubmit={(e) => {
          e.preventDefault();
          toast.info("Newsletter signup isn't available yet.");
          setEmail("");
        }}
      >
        <label htmlFor="home-newsletter-email" className="sr-only">Email address</label>
        <input
          id="home-newsletter-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <button type="submit" className="home-btn home-btn-primary">Subscribe</button>
      </form>
    </section>
  );
}

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: "Verified offers", sub: "AI-checked before they go live" },
  { icon: CalendarDays, label: "Updated daily", sub: "Fresh deals every morning" },
  { icon: Store, label: "Top brands", sub: "Your favorites in one place" },
  { icon: Bell, label: "Never miss a deal", sub: "Alerts for brands you follow" },
];

export function TrustStrip() {
  return (
    <ul className="home-trust">
      {TRUST_ITEMS.map(({ icon: Icon, label, sub }) => (
        <li key={label}>
          <span className="home-trust-icon"><Icon size={20} aria-hidden="true" /></span>
          <span>
            <strong>{label}</strong>
            <small>{sub}</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
