import { useState } from "react";
import { Link } from "react-router";

import { useBanks } from "../api/bankOfferAdmin";
import { useScrapedBusinesses } from "../api/bankOffers";
import { BanksTab } from "../components/bankoffers/BanksTab";
import { BusinessesTab } from "../components/bankoffers/BusinessesTab";
import { CardOffersTab, type OfferFilters } from "../components/bankoffers/CardOffersTab";
import { Icon } from "../components/icons";
import { Tabs } from "../components/ui/Tabs";
import "../components/bankoffers/bankOffers.css";

export function BankOffers() {
  const [tab, setTab] = useState("offers");
  const [lastJobId, setLastJobId] = useState<number | null>(null);
  const [offerFilters, setOfferFilters] = useState<OfferFilters>({});
  const { data: banks } = useBanks();
  const { data: businesses } = useScrapedBusinesses({ limit: 1 });
  const offersCount = banks?.reduce((n, b) => n + b.offers_count, 0);

  function viewOffers(filters: OfferFilters) {
    setOfferFilters(filters);
    setTab("offers");
  }

  return (
    <div className="bo-stack">
      <header className="bo-header">
        <div>
          <h1 className="bo-title">Bank Offers</h1>
          <p className="bo-subtitle">Manage card discounts across businesses, banks and cards.</p>
        </div>
        {lastJobId != null && (
          <Link to="/pipeline" style={{ font: "600 0.8rem/1 var(--font-sans)" }}>Scrape job #{lastJobId} running →</Link>
        )}
      </header>

      <Tabs
        ariaLabel="Bank offer sections"
        active={tab}
        onChange={(id) => { if (id !== "offers") setOfferFilters({}); setTab(id); }}
        tabs={[
          { id: "offers", label: "Card Offers", icon: <Icon.offer size={15} />, count: offersCount },
          { id: "businesses", label: "Businesses", icon: <Icon.store size={15} />, count: businesses?.total },
          { id: "banks", label: "Banks & Cards", icon: <Icon.bank size={15} />, count: banks?.length },
        ]}
      />

      <div role="tabpanel" aria-label={tab}>
        {tab === "offers" && (
          <CardOffersTab
            key={`${offerFilters.bank ?? ""}|${offerFilters.card ?? ""}`}
            initialFilters={offerFilters}
            onScrapeJobStart={setLastJobId}
          />
        )}
        {tab === "businesses" && <BusinessesTab />}
        {tab === "banks" && <BanksTab onViewOffers={viewOffers} />}
      </div>
    </div>
  );
}
