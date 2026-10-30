import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowRight, Bell, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Mail, ShieldCheck, Sparkles } from "lucide-react";

import { useOffers } from "../../api/offers";
import { CategoryCard } from "../../components/public/CategoryCard";
import { OfferCard } from "../../components/public/OfferCard";
import { PublicLayout } from "../../components/public/PublicLayout";
import { useBrandLogoCandidates } from "../../hooks/useBrandLogoCandidates";
import { countBy, imageForOffer, isExpiringSoon, isExpired, toneForName, TONE_BG, TONE_FG } from "../../lib/publicOffers";
import { useSeo } from "../../lib/seo";
import { toast } from "../../store/toastStore";

const CAROUSEL_INTERVAL_MS = 5500;
const HOME_BRAND_FALLBACKS = ["Nike", "Adidas", "Zara", "H&M", "Apple", "Samsung", "Sephora", "Puma", "Levi's", "Uniqlo"];
const HOME_CATEGORY_FALLBACKS = [
  { label: "Fashion", pattern: /fashion|apparel|clothing/i },
  { label: "Electronics", pattern: /electronic|technology|tech/i },
  { label: "Home & Living", pattern: /home|living|furniture/i },
  { label: "Beauty", pattern: /beauty|cosmetic/i },
  { label: "Sports", pattern: /sport|fitness/i },
  { label: "Footwear", pattern: /shoe|footwear/i },
  { label: "Kids", pattern: /kids|children|baby|toy/i },
  { label: "Accessories", pattern: /accessor|bag/i },
];

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--brand)" }}>
          {eyebrow}
        </div>
        <h2 style={{ margin: "4px 0 0", font: "var(--fw-bold) 24px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>{title}</h2>
        {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{subtitle}</p>}
      </div>
      {action && (
        <Link to={action.href} style={{ fontSize: 13, fontWeight: 700, color: "var(--brand)" }}>
          {action.label} →
        </Link>
      )}
    </div>
  );
}

function TrendingBrandChip({ name }: { name: string }) {
  const tone = toneForName(name);
  const candidates = useBrandLogoCandidates(name);
  const [attempt, setAttempt] = useState(0);
  const src = candidates[attempt];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <Link
      to={`/deals/brand/${encodeURIComponent(name)}`}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 76, flex: "0 0 auto", textAlign: "center" }}
    >
      <span
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          background: src ? "var(--surface-card)" : TONE_BG[tone],
          color: TONE_FG[tone],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          font: "800 16px/1 var(--font-sans)",
          border: "1px solid var(--border)",
        }}
      >
        {src ? (
          <img key={src} src={src} alt={name} onError={() => setAttempt((a) => a + 1)} style={{ width: "78%", height: "78%", objectFit: "contain" }} />
        ) : (
          initials || "?"
        )}
      </span>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>
        {name}
      </span>
    </Link>
  );
}

function FollowBrandAvatar({ name, offset }: { name: string; offset: number }) {
  const tone = toneForName(name);
  const candidates = useBrandLogoCandidates(name);
  const [attempt, setAttempt] = useState(0);
  const src = candidates[attempt];

  return (
    <span
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: src ? "var(--surface-card)" : TONE_BG[tone],
        color: TONE_FG[tone],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        font: "800 14px/1 var(--font-sans)",
        border: "2px solid var(--surface-app)",
        marginLeft: offset,
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {src ? (
        <img key={src} src={src} alt={name} onError={() => setAttempt((a) => a + 1)} style={{ width: "78%", height: "78%", objectFit: "contain" }} />
      ) : (
        name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

function EmptyOfferCard({ category }: { category: string }) {
  return (
    <article className="home-empty-card">
      <img src={imageForOffer(category, category, 560, 360)} alt="" aria-hidden />
      <div className="home-empty-card-body">
        <span className="home-empty-badge">NEW FINDS</span>
        <strong>Fresh {category.toLowerCase()} deals</strong>
        <p>We’re looking for the latest offers from your favorite brands.</p>
        <Link to="/deals">Explore Deals <ExternalLink size={12} /></Link>
      </div>
    </article>
  );
}

export function PublicOffers() {
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);
  const [newsletterEmail, setNewsletterEmail] = useState("");

  const { data } = useOffers({ active: "true" });
  const offers = useMemo(() => data?.offers ?? [], [data]);
  const liveOffers = useMemo(() => offers.filter((o) => !isExpired(o)), [offers]);

  const brandCounts = useMemo(() => countBy(liveOffers, "brand"), [liveOffers]);
  const categoryCounts = useMemo(() => countBy(liveOffers, "category"), [liveOffers]);
  const homeBrands = brandCounts.length ? brandCounts.slice(0, 10) : HOME_BRAND_FALLBACKS.map((name) => ({ name, count: 0 }));
  const homeCategories = HOME_CATEGORY_FALLBACKS.map(({ label, pattern }) => {
    const match = categoryCounts.find((category) => pattern.test(category.name));
    return { name: label, count: match?.count ?? 0, filterName: match?.name ?? label };
  });

  const averageSavings = useMemo(() => {
    const withPct = liveOffers.filter((o) => o.discount_percentage != null);
    if (withPct.length === 0) return 0;
    return Math.round(withPct.reduce((sum, o) => sum + (o.discount_percentage ?? 0), 0) / withPct.length);
  }, [liveOffers]);

  const slides = useMemo(
    () =>
      (categoryCounts.length ? categoryCounts.slice(0, 5) : [{ name: "Fashion", count: 0 }]).map((c) => {
        const inCategory = liveOffers.filter((o) => o.category === c.name);
        const bestDiscount = Math.max(0, ...inCategory.map((o) => o.discount_percentage ?? 0));
        return { name: c.name, count: c.count, bestDiscount };
      }),
    [categoryCounts, liveOffers],
  );

  useEffect(() => {
    if (slides.length < 2) return;
    const id = setInterval(() => setSlide((s) => (s + 1) % slides.length), CAROUSEL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [slides.length]);

  const activeSlide = slides[slide % Math.max(slides.length, 1)];

  const hotDeals = useMemo(
    () =>
      [...liveOffers]
        .filter((o) => o.discount_percentage != null)
        .sort((a, b) => (b.discount_percentage ?? 0) - (a.discount_percentage ?? 0))
        .slice(0, 4),
    [liveOffers],
  );

  const forYou = useMemo(() => {
    const hotIds = new Set(hotDeals.map((o) => o.id));
    return [...liveOffers]
      .filter((o) => !hotIds.has(o.id))
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
      .slice(0, 4);
  }, [liveOffers, hotDeals]);

  const expiringSoon = useMemo(
    () =>
      liveOffers
        .filter((o) => isExpiringSoon(o, 7))
        .sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime())
        .slice(0, 4),
    [liveOffers],
  );

  useSeo({
    title: "DealsMore — Big Brands, Bigger Savings",
    description: `Browse ${liveOffers.length}+ AI-verified deals, discounts, and coupon codes from your favorite brands.`,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: hotDeals.slice(0, 10).map((o, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${window.location.origin}/deals/${o.id}`,
        name: o.brand ?? o.company ?? `Offer #${o.id}`,
      })),
    },
  });

  return (
    <PublicLayout>
        <div className="home-page">
      {/* Hero */}
      <section className="home-hero" style={{ borderBottom: "1px solid var(--border)", background: "linear-gradient(160deg, var(--brand-subtle), var(--surface-app) 55%)" }}>
        <div
          style={{
            maxWidth: 1180,
            margin: "0 auto",
            padding: "30px 12px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 28,
            alignItems: "center",
          }}
          className="public-hero-grid"
        >
          {/* Left: copy */}
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
              Deals Today. A Better Tomorrow.
            </div>
            <h1 style={{ margin: 0, font: "var(--fw-extra) 42px/1.12 var(--font-sans)", letterSpacing: "var(--ls-tight)", color: "var(--text-strong)" }}>
              Big Brands
              <br />
              <span style={{ color: "var(--brand)" }}>Bigger Savings</span>
            </h1>
            <p style={{ margin: "16px 0 26px", fontSize: 15, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 420 }}>
              Discover the best offers, promo codes and exclusive deals from your favorite brands — all in one place.
            </p>

            <Link
              to="/deals"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                height: 46,
                padding: "0 22px",
                borderRadius: "var(--radius-sm)",
                background: "var(--brand)",
                color: "var(--on-brand)",
                fontWeight: 700,
                fontSize: 13.5,
                boxShadow: "var(--shadow-brand)",
              }}
            >
              Explore Deals <ArrowRight size={15} />
            </Link>

            <div className="home-stats" style={{ display: "flex", gap: 36, marginTop: 36 }}>
              <div>
                <div style={{ font: "var(--fw-extra) 24px/1 var(--font-sans)", color: "var(--brand)" }}>{liveOffers.length}+</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>Active Offers</div>
              </div>
              <div>
                <div style={{ font: "var(--fw-extra) 24px/1 var(--font-sans)", color: "var(--text-strong)" }}>{brandCounts.length}+</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>Top Brands</div>
              </div>
              <div>
                <div style={{ font: "var(--fw-extra) 24px/1 var(--font-sans)", color: "var(--brand)" }}>Up to {averageSavings}%</div>
                <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginTop: 4 }}>Average Savings</div>
              </div>
            </div>
          </div>

          {/* Right: carousel */}
          {activeSlide && (
            <div
              style={{
                position: "relative",
                borderRadius: "var(--radius-lg)",
                overflow: "hidden",
                minHeight: 300,
                boxShadow: "var(--shadow-md)",
                display: "flex",
                alignItems: "flex-end",
                padding: 28,
              }}
              className="public-hero-carousel home-hero-art"
            >
              <img
                key={activeSlide.name}
                src={imageForOffer("fashion", activeSlide.name, 900, 600)}
                alt=""
                aria-hidden
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(0deg, rgba(0,0,0,0.55), rgba(0,0,0,0.1) 60%)" }} />

              <div className="home-hero-copy">
                <strong>{activeSlide.name.toUpperCase()}<br />DEALS</strong>
                <span>Style More<br />Spend Less</span>
                <button type="button" onClick={() => navigate(`/deals?category=${encodeURIComponent(activeSlide.name)}`)}>
                  Shop Now <ArrowRight size={14} />
                </button>
              </div>

              <div style={{ position: "absolute", top: 22, right: 22, width: 74, height: 74, borderRadius: "50%", background: "var(--brand)", color: "var(--on-brand)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", boxShadow: "var(--shadow-md)", zIndex: 1 }}>
                <span style={{ fontSize: 9.5, fontWeight: 700, lineHeight: 1.1 }}>UP TO</span>
                <span style={{ fontSize: 17, fontWeight: 800, lineHeight: 1.1 }}>{activeSlide.bestDiscount}%</span>
                <span style={{ fontSize: 9.5, fontWeight: 700, lineHeight: 1.1 }}>OFF</span>
              </div>

              <div style={{ color: "#FFFFFF", position: "relative", zIndex: 1 }}>
                <div className="home-hero-slide-note">{activeSlide.count} offers to discover</div>
              </div>

              {slides.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setSlide((s) => (s - 1 + slides.length) % slides.length)}
                    aria-label="Previous"
                    style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.85)", color: "var(--text-strong)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setSlide((s) => (s + 1) % slides.length)}
                    aria-label="Next"
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", width: 32, height: 32, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.85)", color: "var(--text-strong)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <ChevronRight size={14} />
                  </button>
                  <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
                    {slides.map((s, i) => (
                      <button
                        key={s.name}
                        type="button"
                        onClick={() => setSlide(i)}
                        aria-label={`Go to ${s.name}`}
                        style={{ width: i === slide ? 16 : 6, height: 6, borderRadius: 3, border: "none", background: i === slide ? "#FFFFFF" : "rgba(255,255,255,0.5)", cursor: "pointer", padding: 0 }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </section>

        <div className="home-content" style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 12px 0" }}>
        {/* Trending brands */}
        {homeBrands.length > 0 && (
          <section id="brands" className="home-brands" style={{ marginBottom: 26, scrollMarginTop: 84 }}>
            <SectionHeading eyebrow="Popular" title="Trending Brands" action={{ label: "View All", href: "/deals/brands" }} />
            <div className="public-scroll-row">
              {homeBrands.map((b) => (
                <TrendingBrandChip key={b.name} name={b.name} />
              ))}
            </div>
          </section>
        )}

        {/* Categories */}
        {homeCategories.length > 0 && (
          <section id="categories" className="home-categories" style={{ marginBottom: 26, scrollMarginTop: 84 }}>
            <SectionHeading eyebrow="Browse" title="Browse by Category" action={{ label: "View All", href: "/categories" }} />
            <div className="home-category-grid" style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: 10 }}>
              {homeCategories.map((c) => (
                <CategoryCard key={c.name} name={c.name} offerCount={c.count} onClick={() => navigate(`/deals?category=${encodeURIComponent(c.filterName)}`)} />
              ))}
            </div>
          </section>
        )}

        {/* Follow brands promo */}
        <section
          className="home-follow-banner"
          style={{
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            background: "var(--brand-subtle)",
            borderRadius: "var(--radius-lg)",
            padding: "24px 22px",
          }}
        >
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--brand)", marginBottom: 6 }}>
              Follow Your Favorite Brands
            </div>
            <h3 style={{ margin: 0, font: "var(--fw-bold) 22px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>
              Get Notified for <span style={{ color: "var(--brand)" }}>New Deals</span>
            </h3>
            <p style={{ margin: "8px 0 18px", fontSize: 13.5, color: "var(--text-muted)", maxWidth: 420 }}>
              Never miss a great offer. Follow brands and get instant alerts when they launch new deals.
            </p>
            <Link
              to="/sign-in"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 42, padding: "0 20px", borderRadius: "var(--radius-sm)", background: "var(--brand)", color: "var(--on-brand)", fontWeight: 700, fontSize: 13 }}
            >
              Follow Brands <ArrowRight size={14} />
            </Link>
          </div>
          <div className="home-follow-visual">
            <div className="home-follow-avatars" style={{ display: "flex", gap: -10, flex: "0 0 auto" }}>
              {homeBrands.slice(0, 3).map((b, i) => (
                <FollowBrandAvatar key={b.name} name={b.name} offset={i === 0 ? 0 : -14} />
              ))}
            </div>
            <div className="home-phone" aria-hidden="true">
              <span className="home-phone-notch" />
              <span className="home-phone-bell"><Bell size={34} /></span>
              <strong>New Deals</strong>
              <small>Just for You!</small>
            </div>
          </div>
        </section>

        {/* Hot deals */}
          <section className="home-deals-section" style={{ marginBottom: 28 }}>
            <SectionHeading
              eyebrow="Handpicked"
              title="Hot Deals 🔥"
              subtitle="The biggest and latest offers, handpicked for you."
              action={{ label: "View All", href: "/deals" }}
            />
            <div className="home-deal-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
              {hotDeals.length ? hotDeals.map((o) => (
                <OfferCard key={o.id} offer={o} editorialImage />
              )) : HOME_CATEGORY_FALLBACKS.slice(0, 4).map((category) => <EmptyOfferCard key={category.label} category={category.label} />)}
            </div>
          </section>

        {/* For you */}
          <section className="home-deals-section" style={{ marginBottom: 28 }}>
            <SectionHeading
              eyebrow="Curated"
              title="For You ✨"
              subtitle="Personalized offers based on your interests."
              action={{ label: "View All", href: "/deals" }}
            />
            <div className="home-deal-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
              {forYou.length ? forYou.map((o) => (
                <OfferCard key={o.id} offer={o} editorialImage />
              )) : HOME_CATEGORY_FALLBACKS.slice(2, 6).map((category) => <EmptyOfferCard key={category.label} category={category.label} />)}
            </div>
          </section>

        {/* Expiring soon */}
          <section id="expiring" className="home-deals-section" style={{ marginBottom: 28, scrollMarginTop: 84 }}>
            <SectionHeading
              eyebrow="Act fast"
              title="Expiring Soon ⏰"
              subtitle="Hurry up! These offers won't last long."
              action={{ label: "View All", href: "/deals" }}
            />
            <div className="home-deal-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 14 }}>
              {expiringSoon.length ? expiringSoon.map((o) => (
                <OfferCard key={o.id} offer={o} editorialImage />
              )) : HOME_CATEGORY_FALLBACKS.slice(4, 8).map((category) => <EmptyOfferCard key={category.label} category={category.label} />)}
            </div>
          </section>

        {/* Newsletter band */}
        <section
          className="home-newsletter"
          style={{
            marginBottom: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            flexWrap: "wrap",
            background: "var(--surface-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 18px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--brand-subtle)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
              <Mail size={18} />
            </span>
            <div>
              <div style={{ font: "var(--fw-semibold) 15px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>Get the Best Deals in Your Inbox</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                Subscribe to our newsletter and be the first to know about new offers, exclusive discounts and top brands.
              </div>
            </div>
          </div>
          <div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                toast.info("Newsletter signup isn't available yet — check back soon.");
                setNewsletterEmail("");
              }}
              style={{ display: "flex", gap: 8 }}
            >
              <input
                type="email"
                required
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="Enter your email"
                aria-label="Email for newsletter"
                style={{ height: 42, width: 220, padding: "0 14px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--surface-app)", color: "var(--text-strong)", fontSize: 13 }}
              />
              <button type="submit" style={{ height: 42, padding: "0 18px", border: "none", borderRadius: "var(--radius-sm)", background: "var(--brand)", color: "var(--on-brand)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                Subscribe
              </button>
            </form>
            <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-faint)" }}>No spam. Unsubscribe anytime.</div>
          </div>
        </section>

        {/* Feature strip */}
        <div className="home-trust-strip" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 20, margin: "0 0 28px" }}>
          {[
            { icon: <ShieldCheck size={17} />, label: "Verified Offers", sub: "Only real and tested deals" },
            { icon: <CalendarDays size={17} />, label: "Updated Daily", sub: "Fresh deals every day" },
            { icon: <Sparkles size={17} />, label: "Top Brands", sub: "Your favorite brands in one place" },
            { icon: <Bell size={17} />, label: "Never Miss a Deal", sub: "Follow brands and get alerts" },
          ].map((f) => (
            <div key={f.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                style={{
                  width: 38,
                  height: 38,
                  flex: "0 0 auto",
                  borderRadius: "50%",
                  border: "1.5px solid var(--brand)",
                  color: "var(--brand)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {f.icon}
              </span>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-strong)" }}>{f.label}</div>
                <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      </div>
    </PublicLayout>
  );
}
