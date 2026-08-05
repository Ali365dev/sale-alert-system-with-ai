import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  imageForCategory,
  mapApiBrandToBrand,
  mapApiOfferToDeal,
  syntheticBrand,
} from '@/api/adapters';
import { fetchBrands, fetchOffers } from '@/api/client';
import { ApiBrand, ApiOffer } from '@/api/types';
import { AlertItem, Brand, CategoryInfo, Deal } from '@/types/dealpulse';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const CATEGORY_ICONS: { match: RegExp; icon: string }[] = [
  { match: /fashion|apparel|clothing|retail/i, icon: 'tshirt-crew-outline' },
  { match: /electronic|software|tech/i, icon: 'laptop' },
  { match: /beauty|cosmetic/i, icon: 'face-woman-outline' },
  { match: /food|restaurant|grocery/i, icon: 'silverware-fork-knife' },
  { match: /travel/i, icon: 'airplane' },
  { match: /sport|fitness/i, icon: 'basketball' },
  { match: /home|furniture/i, icon: 'sofa-outline' },
  { match: /gaming|game/i, icon: 'controller-classic-outline' },
];
function iconForCategory(name: string): string {
  return CATEGORY_ICONS.find((c) => c.match.test(name))?.icon ?? 'tag-outline';
}

interface AppDataValue {
  brands: Brand[];
  deals: Deal[];
  categories: CategoryInfo[];
  alerts: AlertItem[];
  brandsById: Record<string, Brand>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [apiBrands, setApiBrands] = useState<ApiBrand[]>([]);
  const [apiOffers, setApiOffers] = useState<ApiOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchBrands(), fetchOffers()])
      .then(([brandsRes, offersRes]) => {
        if (cancelled) return;
        setApiBrands(brandsRes.brands);
        setApiOffers(offersRes.offers);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const refresh = useCallback(() => setReloadToken((t) => t + 1), []);

  const { brands, deals, brandsById } = useMemo(() => {
    const offerCountByBrandId = new Map<string, number>();
    for (const offer of apiOffers) {
      if (!offer.brand) continue;
      const id = slugify(offer.brand);
      offerCountByBrandId.set(id, (offerCountByBrandId.get(id) ?? 0) + 1);
    }

    const registered = apiBrands.map((b) =>
      mapApiBrandToBrand(b, offerCountByBrandId.get(slugify(b.name)) ?? 0)
    );
    const registeredIds = new Set(registered.map((b) => b.id));

    const synthetic: Brand[] = [];
    const seenSynthetic = new Set<string>();
    for (const offer of apiOffers) {
      if (!offer.brand) continue;
      const id = slugify(offer.brand);
      if (registeredIds.has(id) || seenSynthetic.has(id)) continue;
      seenSynthetic.add(id);
      synthetic.push(
        syntheticBrand(offer.brand, offer.category, offerCountByBrandId.get(id) ?? 0, offer.website)
      );
    }

    const allBrands = [...registered, ...synthetic];
    const byId = Object.fromEntries(allBrands.map((b) => [b.id, b]));

    const allDeals = apiOffers
      .filter((o) => o.brand)
      .map((o) => mapApiOfferToDeal(o, slugify(o.brand!)));

    return { brands: allBrands, deals: allDeals, brandsById: byId };
  }, [apiBrands, apiOffers]);

  const categories = useMemo<CategoryInfo[]>(() => {
    const counts = new Map<string, number>();
    for (const offer of apiOffers) {
      if (!offer.category) continue;
      counts.set(offer.category, (counts.get(offer.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, dealCount]) => ({ name, dealCount, icon: iconForCategory(name) }))
      .sort((a, b) => b.dealCount - a.dealCount);
  }, [apiOffers]);

  const alerts = useMemo<AlertItem[]>(() => {
    const sorted = [...apiOffers].sort((a, b) => {
      const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bT - aT;
    });
    return sorted.slice(0, 15).map((offer, index) => {
      const isFlash = (offer.discount_percentage ?? 0) >= 30;
      const brandId = offer.brand ? slugify(offer.brand) : null;
      return {
        id: `offer-alert-${offer.id}`,
        kind: isFlash ? 'flash-sale' : 'new-brand',
        title: isFlash
          ? `Flash Sale: ${offer.brand ?? 'New offer'}`
          : `New offer from ${offer.brand ?? 'a tracked brand'}`,
        body:
          offer.summary?.slice(0, 100) ??
          (offer.discount_percentage ? `${offer.discount_percentage}% off` : 'New offer tracked'),
        time: offer.created_at ? new Date(offer.created_at).toLocaleDateString() : '',
        brandId,
        read: index >= 5,
      };
    });
  }, [apiOffers]);

  const value = useMemo(
    () => ({ brands, deals, categories, alerts, brandsById, loading, error, refresh }),
    [brands, deals, categories, alerts, brandsById, loading, error, refresh]
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within DataProvider');
  return ctx;
}

export { imageForCategory };
