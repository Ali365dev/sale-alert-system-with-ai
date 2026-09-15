// No image data exists on the backend — every image below is a category-keyed
// placeholder, not real brand/offer photography.
const CATEGORY_IMAGE_QUERIES = [
  { match: /fashion|apparel|clothing|retail/i, query: 'photo-1483985988355-763728e1935b' },
  { match: /electronic|software|tech/i, query: 'photo-1518770660439-4636190af475' },
  { match: /beauty|cosmetic/i, query: 'photo-1522335789203-aabd1fc54bc9' },
  { match: /food|restaurant|grocery/i, query: 'photo-1504674900247-0877df9cc836' },
  { match: /travel/i, query: 'photo-1436491865332-7a61a109cc05' },
  { match: /sport|fitness/i, query: 'photo-1517649763962-0c623066013b' },
  { match: /home|furniture/i, query: 'photo-1484154218962-a197022b5858' },
  { match: /gaming|game/i, query: 'photo-1550745165-9bc0b252726f' },
];
const DEFAULT_IMAGE_QUERY = 'photo-1607082349566-187342175e2f';

const CATEGORY_ICONS = [
  { match: /footwear|shoe/i, icon: 'shoe-sneaker' },
  { match: /fashion|apparel|clothing|retail/i, icon: 'tshirt-crew-outline' },
  { match: /electronic|software|tech/i, icon: 'laptop' },
  { match: /beauty|cosmetic/i, icon: 'face-woman-outline' },
  { match: /food|restaurant|grocery/i, icon: 'silverware-fork-knife' },
  { match: /travel/i, icon: 'airplane' },
  { match: /sport|fitness/i, icon: 'basketball' },
  { match: /home|furniture/i, icon: 'sofa-outline' },
  { match: /gaming|game/i, icon: 'controller-classic-outline' },
];

export const imageForCategory = (category) => {
  const match = category ? CATEGORY_IMAGE_QUERIES.find((c) => c.match.test(category)) : undefined;
  return `https://images.unsplash.com/${match?.query ?? DEFAULT_IMAGE_QUERY}?w=1200&q=80`;
};

export const iconForCategory = (name) => CATEGORY_ICONS.find((c) => c.match.test(name))?.icon ?? 'tag-outline';

export const initialsForName = (name) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

export const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/** Strip regional suffixes so offer brand "Hush Puppies" matches DB
 * "Hush Puppies Pakistan" (same logo / brand row). */
export const normalizeBrandKey = (name) =>
  slugify(name || '')
    .replace(/-pakistan$/g, '')
    .replace(/-pak$/g, '')
    .replace(/-pk$/g, '')
    .replace(/-official$/g, '');

/** Map an offer's brand name to a registered Brand row id when the names
 * only differ by a regional suffix (or exact slug match). */
export const resolveRegisteredBrandId = (offerBrandName, registeredBrands) => {
  const offerSlug = slugify(offerBrandName || '');
  if (!offerSlug) return null;
  const exact = registeredBrands.find((b) => b.id === offerSlug);
  if (exact) return exact.id;
  const offerKey = normalizeBrandKey(offerBrandName);
  const fuzzy = registeredBrands.find((b) => normalizeBrandKey(b.name) === offerKey);
  return fuzzy?.id ?? null;
};

export const mapApiBrandToBrand = (apiBrand, dealCount) => {
  const category = apiBrand.categories?.[0] ?? 'General';
  return {
    id: slugify(apiBrand.name) || String(apiBrand.id),
    name: apiBrand.name,
    initials: initialsForName(apiBrand.name),
    logoUrl: apiBrand.logo_url ?? null,
    color: '#171717',
    category,
    dealCount,
    description: apiBrand.website
      ? `Tracked offers from ${apiBrand.name} (${apiBrand.website}).`
      : `Tracked offers from ${apiBrand.name}.`,
    coverImage: imageForCategory(category),
    website: apiBrand.website,
  };
};

/** Synthesizes an unregistered "brand" placeholder for offers whose brand name has no Brand row —
 * so it has no logo_url on file either, hence logoUrl is always null here. */
export const syntheticBrand = (name, category, dealCount, website = null) => ({
  id: slugify(name),
  name,
  initials: initialsForName(name),
  logoUrl: null,
  color: '#171717',
  category: category ?? 'General',
  dealCount,
  description: `Tracked offers from ${name}.`,
  coverImage: imageForCategory(category),
  website,
});

export const mapApiOfferToDeal = (offer, brandId) => {
  const discountLabel = offer.discount_percentage
    ? `-${Math.round(offer.discount_percentage)}%`
    : offer.offer_type
      ? offer.offer_type.toUpperCase()
      : 'DEAL';

  // The email subject is the brand's own original promotional title — always
  // preferred over an AI-derived one. Only offers with no source email
  // (source="ai", web-scraped) fall back to a derived title.
  const title =
    offer.title ||
    offer.summary?.split(/(?<=[.!?])\s/)[0]?.slice(0, 80) ||
    `${offer.brand ?? 'New'} offer — ${discountLabel}`;

  return {
    id: String(offer.id),
    brandId,
    title,
    description: offer.summary ?? 'No description available yet for this offer.',
    highlights: offer.key_highlights,
    terms:
      'Offer valid while supplies last. The brand reserves the right to modify or cancel this promotion at any time without notice. Standard return policy applies. Discount applied at checkout.',
    discountLabel,
    image: offer.image_url || imageForCategory(offer.category),
    category: offer.category ?? 'General',
    subcategory: offer.subcategory ?? null,
    expiresAt: offer.expiry_date ?? '',
    promoCode: offer.coupon_code,
    isFlashSale: (offer.discount_percentage ?? 0) >= 30,
    isFeatured: offer.verification_status === 'verified',
    isOnline: true,
    isInStore: true,
    country: 'Global',
    website: offer.website,
    isPercentageOff: offer.discount_percentage != null,
    createdAt: offer.created_at,
  };
};

/** Derives {brands, deals, brandsById} from raw API brands + offers — registered
 * brands first, then a synthetic placeholder brand for any offer whose brand
 * name has no matching Brand row. Mirrors mobile/src/state/data.tsx's useMemo. */
export const deriveBrandsAndDeals = (apiBrands, apiOffers) => {
  const offerCountByBrandId = new Map();
  for (const offer of apiOffers) {
    if (!offer.brand) continue;
    const id = slugify(offer.brand);
    offerCountByBrandId.set(id, (offerCountByBrandId.get(id) ?? 0) + 1);
  }

  const registered = apiBrands.map((b) => mapApiBrandToBrand(b, offerCountByBrandId.get(slugify(b.name)) ?? 0));
  // Recount with fuzzy keys so "Hush Puppies" offers attach to "Hush Puppies Pakistan".
  const dealCountByRegisteredId = new Map(registered.map((b) => [b.id, 0]));
  for (const offer of apiOffers) {
    if (!offer.brand) continue;
    const resolved = resolveRegisteredBrandId(offer.brand, registered) || slugify(offer.brand);
    if (dealCountByRegisteredId.has(resolved)) {
      dealCountByRegisteredId.set(resolved, (dealCountByRegisteredId.get(resolved) ?? 0) + 1);
    }
  }
  const registeredWithCounts = registered.map((b) => ({
    ...b,
    dealCount: dealCountByRegisteredId.get(b.id) ?? b.dealCount,
  }));
  const registeredIds = new Set(registeredWithCounts.map((b) => b.id));

  const synthetic = [];
  const seenSynthetic = new Set();
  for (const offer of apiOffers) {
    if (!offer.brand) continue;
    const resolvedId = resolveRegisteredBrandId(offer.brand, registeredWithCounts);
    if (resolvedId) continue;
    const id = slugify(offer.brand);
    if (registeredIds.has(id) || seenSynthetic.has(id)) continue;
    seenSynthetic.add(id);
    synthetic.push(syntheticBrand(offer.brand, offer.category, offerCountByBrandId.get(id) ?? 0, offer.website));
  }

  const brands = [...registeredWithCounts, ...synthetic];
  const brandsById = Object.fromEntries(brands.map((b) => [b.id, b]));
  const deals = apiOffers
    .filter((o) => o.brand)
    .map((o) => {
      const brandId = resolveRegisteredBrandId(o.brand, brands) || slugify(o.brand);
      return mapApiOfferToDeal(o, brandId);
    });

  return { brands, deals, brandsById };
};

/** Derives category counts (sorted by deal count desc) from raw API offers. */
export const deriveCategories = (apiOffers) => {
  const counts = new Map();
  for (const offer of apiOffers) {
    if (!offer.category) continue;
    counts.set(offer.category, (counts.get(offer.category) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, dealCount]) => ({ name, dealCount, icon: iconForCategory(name) }))
    .sort((a, b) => b.dealCount - a.dealCount);
};

/** Brand AND category match against saved preferences, newest first.
 * Empty brands or empty categories yield no matches in the default AND mode
 * (same rule as the backend). Shared by HomeScreen and ForYouScreen. */
export const filterForYou = (deals, followedBrands, favoriteCategories) => {
  if (followedBrands.length === 0 || favoriteCategories.length === 0) return [];
  const brandSlugs = new Set(followedBrands.map(slugify));
  const categorySet = new Set(favoriteCategories.map((c) => c.toLowerCase()));
  const matched = deals.filter((d) => {
    if (!brandSlugs.has(d.brandId)) return false;
    const cats = [d.category, d.subcategory].filter(Boolean).map((c) => String(c).toLowerCase());
    return cats.some((c) => categorySet.has(c));
  });
  return [...matched].sort((a, b) => {
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });
};

/** Derives the notification feed (newest 15 offers) from raw API offers.
 * Mirrors mobile/src/state/data.tsx's alerts useMemo. */
export const deriveAlerts = (apiOffers) => {
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
      title: isFlash ? `Flash Sale: ${offer.brand ?? 'New offer'}` : `New offer from ${offer.brand ?? 'a tracked brand'}`,
      body: offer.summary?.slice(0, 100) ?? (offer.discount_percentage ? `${offer.discount_percentage}% off` : 'New offer tracked'),
      time: offer.created_at ? new Date(offer.created_at).toLocaleDateString() : '',
      brandId,
      read: index >= 5,
    };
  });
};
