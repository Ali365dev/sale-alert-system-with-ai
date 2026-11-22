import { useMemo } from "react";
import { useNavigate } from "react-router";
import { Clock3, Flame, Sparkles } from "lucide-react";

import { useOffers } from "../../api/offers";
import { CategoryCard } from "../../components/public/CategoryCard";
import { DealGrid, HomeSection } from "../../components/public/home/HomeSection";
import { HomeHero } from "../../components/public/home/HomeHero";
import { FollowBanner, NewsletterBand, TrendingBrands, TrustStrip } from "../../components/public/home/HomePromos";
import { PublicLayout } from "../../components/public/PublicLayout";
import { offerCompleteness } from "../../lib/offerDisplay";
import { countBy, isExpiringSoon, isExpired } from "../../lib/publicOffers";
import { useSeo } from "../../lib/seo";
import "../../components/public/home/home.css";

const RAIL_SIZE = 4;

export function PublicOffers() {
  const navigate = useNavigate();
  const { data, isLoading } = useOffers({ active: "true" });
  const liveOffers = useMemo(() => (data?.offers ?? []).filter((o) => !isExpired(o)), [data]);

  const brandCounts = useMemo(() => countBy(liveOffers, "brand"), [liveOffers]);
  const categories = useMemo(() => countBy(liveOffers, "category").filter((c) => !/^other$/i.test(c.name)).slice(0, 8), [liveOffers]);
  const maxDiscount = useMemo(() => Math.round(Math.max(0, ...liveOffers.map((o) => o.discount_percentage ?? 0))), [liveOffers]);

  const hotDeals = useMemo(
    () =>
      liveOffers
        .filter((o) => (o.discount_percentage ?? 0) >= 1)
        .sort((a, b) => offerCompleteness(b) - offerCompleteness(a) || (b.discount_percentage ?? 0) - (a.discount_percentage ?? 0))
        .slice(0, RAIL_SIZE),
    [liveOffers],
  );

  const expiringSoon = useMemo(
    () =>
      liveOffers
        .filter((o) => isExpiringSoon(o, 7))
        .sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime())
        .slice(0, RAIL_SIZE),
    [liveOffers],
  );

  const forYou = useMemo(() => {
    const shown = new Set([...hotDeals, ...expiringSoon].map((o) => o.id));
    return liveOffers
      .filter((o) => !shown.has(o.id))
      .sort((a, b) => offerCompleteness(b) - offerCompleteness(a) || b.id - a.id)
      .slice(0, RAIL_SIZE);
  }, [liveOffers, hotDeals, expiringSoon]);

  const spotlight = useMemo(
    () => [...hotDeals].sort((a, b) => (b.discount_percentage ?? 0) - (a.discount_percentage ?? 0)).slice(0, 3),
    [hotDeals],
  );

  useSeo({
    title: "DealsMore — Big Brands, Bigger Savings",
    description: `Browse ${liveOffers.length}+ AI-verified deals, discounts, and coupon codes from your favorite brands.`,
    structuredData: {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: hotDeals.map((o, i) => ({
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
        <HomeHero offerCount={liveOffers.length} brandCount={brandCounts.length} maxDiscount={maxDiscount} spotlight={spotlight} />

        <div className="home-container home-content">
          {brandCounts.length > 0 && (
            <HomeSection id="brands" title="Trending brands" subtitle="Most active brands this week" viewAllHref="/deals/brands">
              <TrendingBrands brands={brandCounts.slice(0, 10)} />
            </HomeSection>
          )}

          {categories.length > 0 && (
            <HomeSection id="categories" title="Shop by category" viewAllHref="/categories">
              <div className="home-category-grid">
                {categories.map((c) => (
                  <CategoryCard key={c.name} name={c.name} offerCount={c.count} onClick={() => navigate(`/deals?category=${encodeURIComponent(c.name)}`)} />
                ))}
              </div>
            </HomeSection>
          )}

          <HomeSection id="hot" icon={Flame} title="Hot deals" subtitle="The biggest discounts, handpicked for you." viewAllHref="/deals">
            <DealGrid offers={hotDeals} loading={isLoading} emptyText="Big discounts show up here as soon as brands announce them." />
          </HomeSection>

          <FollowBanner brands={brandCounts.slice(0, 4).map((b) => b.name)} />

          <HomeSection id="expiring" icon={Clock3} title="Ending soon" subtitle="Grab these before they’re gone." viewAllHref="/deals">
            <DealGrid offers={expiringSoon} loading={isLoading} emptyText="No offers are ending this week." />
          </HomeSection>

          <HomeSection id="for-you" icon={Sparkles} title="Fresh for you" subtitle="New arrivals from brands you might like." viewAllHref="/deals">
            <DealGrid offers={forYou} loading={isLoading} emptyText="Check back soon for new arrivals." />
          </HomeSection>

          <NewsletterBand />
          <TrustStrip />
        </div>
      </div>
    </PublicLayout>
  );
}
