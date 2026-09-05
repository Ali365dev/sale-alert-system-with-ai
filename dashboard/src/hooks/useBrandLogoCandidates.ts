import { useMemo } from "react";

import { useBrands } from "../api/brands";
import { hostnameOf } from "../lib/publicOffers";

/** Ordered candidate image URLs for a brand, most-trustworthy first — the
 * caller tries each in order and falls back to the next on load failure
 * (see BrandLogo). Brand.logo_url is AI-suggested (see
 * ai/brand_identifier.py) and only ever set for brands discovered through
 * the "unknown sender" flow, so it's populated for very few brands and
 * sometimes stale/dead; a favicon derived from the brand's own website
 * (Google's public s2/favicons service — no API key, no account needed)
 * covers the rest without waiting on that field to be backfilled. */
export function useBrandLogoCandidates(name: string | null | undefined): string[] {
  const { data } = useBrands();
  return useMemo(() => {
    if (!name) return [];
    const brand = data?.brands.find((b) => b.name === name);
    const candidates: string[] = [];
    if (brand?.logo_url) candidates.push(brand.logo_url);
    const host = hostnameOf(brand?.website ?? null);
    if (host) candidates.push(`https://www.google.com/s2/favicons?domain=${host}&sz=128`);
    return candidates;
  }, [data, name]);
}
