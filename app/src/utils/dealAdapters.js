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

/** Lucide keys used by CategoryIcon. More specific matches come first. */
const CATEGORY_ICONS = [
  { match: /footwear|shoe|sneaker|boot|sandal/i, icon: 'footprints' },
  { match: /watch/i, icon: 'watch' },
  { match: /jewel/i, icon: 'gem' },
  { match: /eyewear|glass|sunglass|optic/i, icon: 'glasses' },
  { match: /web\s*server|\bservers?\b/i, icon: 'server' },
  { match: /\bsoftware\b/i, icon: 'windows' },
  { match: /bag|wallet|accessor/i, icon: 'bag' },
  { match: /baby|kid|toy|child/i, icon: 'baby' },
  { match: /\b(?:auto|cars?|vehicles?|motors?)\b/i, icon: 'car' },
  { match: /health|pharma|wellness|medical/i, icon: 'health' },
  { match: /book|audio|education/i, icon: 'book' },
  { match: /pet|animal/i, icon: 'pet' },
  { match: /office|stationer/i, icon: 'briefcase' },
  { match: /fashion|apparel|clothing|retail/i, icon: 'shirt' },
  { match: /electronic|tech|gadget|phone|computer/i, icon: 'laptop' },
  { match: /beauty|cosmetic|skin|makeup|fragrance|perfume/i, icon: 'sparkles' },
  { match: /food|restaurant|grocery|dining|cafe|coffee/i, icon: 'utensils' },
  { match: /travel|flight|hotel/i, icon: 'plane' },
  { match: /sport|fitness|gym/i, icon: 'dumbbell' },
  { match: /garden|plant|flower/i, icon: 'flower' },
  { match: /furniture|sofa|decor/i, icon: 'sofa' },
  { match: /home/i, icon: 'house' },
  { match: /gaming|game/i, icon: 'gamepad' },
];

export const imageForCategory = (category) => {
  const match = category ? CATEGORY_IMAGE_QUERIES.find((c) => c.match.test(category)) : undefined;
  return `https://images.unsplash.com/${match?.query ?? DEFAULT_IMAGE_QUERY}?w=1200&q=80`;
};

export const iconForCategory = (name) => CATEGORY_ICONS.find((c) => c.match.test(name))?.icon ?? 'tag';

export const initialsForName = (name) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};

/** Discount headline matching the Figma deals list — "Flat 40% Off". */
export const formatFlatOffer = (deal) => {
  if (!deal) return 'Deal';
  if (deal.isPercentageOff) {
    const n = String(deal.discountLabel || '').replace(/[^0-9.]/g, '');
    return n ? `Flat ${n}% Off` : deal.title || 'Deal';
  }
  const raw = String(deal.discountLabel || '').replace(/^-/, '').trim();
  // Offer types like OTHER are not a discount amount — show the offer title.
  if (raw && /\d/.test(raw)) return `Flat ${raw} Off`;
  return deal.title || 'Deal';
};

/** Display form for list/detail cards — "40% OFF" or raw offer type. */
export const formatDiscountDisplay = (deal) => {
  if (!deal) return 'DEAL';
  if (deal.isPercentageOff && deal.discountLabel) {
    return `${String(deal.discountLabel).replace('-', '')} OFF`;
  }
  return deal.discountLabel || 'DEAL';
};

/** Short percent for coupon tickets — "25%" (no OFF suffix). */
export const formatDiscountPercent = (deal) => {
  if (!deal) return 'Deal';
  const raw = String(deal.discountLabel || '').replace(/[^0-9.]/g, '');
  if (deal.isPercentageOff && raw) return `${raw}%`;
  if (raw && String(deal.discountLabel || '').includes('%')) return `${raw}%`;
  if (deal.discountLabel) return String(deal.discountLabel).replace(/^-/, '');
  return 'Deal';
};

/** Short expiry line matching the coupon mock: "Exp: 25 May 2025". */
export const formatExpiryShort = (expiresAt) => {
  if (!expiresAt) return 'No expiry';
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return 'No expiry';
  if (date.getTime() < Date.now()) return 'Expired';
  return `Exp: ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
};

/** Relative time for coupon tickets — "3 minutes ago". */
export const formatRelativeTime = (iso) => {
  if (!iso) return 'Just now';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Just now';
  const diff = Math.max(0, Date.now() - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return formatExpiryShort(iso);
};

/** ONLINE vs IN-STORE tag — link/code ⇒ online; otherwise treat as in-store. */
export const channelTag = (deal) => {
  if (!deal) return 'ONLINE';
  if (deal.website || deal.promoCode) return 'ONLINE';
  return 'IN-STORE';
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
    logoScale: apiBrand.logo_scale ?? 1,
    logoOffsetX: apiBrand.logo_offset_x ?? 0,
    logoOffsetY: apiBrand.logo_offset_y ?? 0,
    color: '#10233F',
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
  logoScale: 1,
  logoOffsetX: 0,
  logoOffsetY: 0,
  color: '#10233F',
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

/** Derives category counts (sorted by deal count desc) from managed categories
 * when provided, else from raw API offers + brand-tagged categories.
 *
 * `managedCategories` is the admin catalog from GET /categories (active only).
 * Offer counts still come from the offers list so the UI stays live. */
export const deriveCategories = (apiOffers, apiBrands = [], managedCategories = null) => {
  const counts = new Map();
  for (const brand of apiBrands) {
    for (const name of brand.categories ?? []) {
      if (name && !counts.has(name)) counts.set(name, 0);
    }
  }
  for (const offer of apiOffers) {
    if (!offer.category) continue;
    counts.set(offer.category, (counts.get(offer.category) ?? 0) + 1);
  }

  if (Array.isArray(managedCategories) && managedCategories.length > 0) {
    return managedCategories
      .filter((c) => c && c.name && c.is_active !== false)
      .map((c) => ({
        name: c.name,
        dealCount: counts.get(c.name) ?? c.offer_count ?? 0,
        icon: iconForCategory(c.name),
        sortOrder: c.sort_order ?? 0,
      }))
      .sort((a, b) => b.dealCount - a.dealCount || a.name.localeCompare(b.name));
  }

  return Array.from(counts.entries())
    .map(([name, dealCount]) => ({ name, dealCount, icon: iconForCategory(name) }))
    .sort((a, b) => b.dealCount - a.dealCount);
};

/** Brand AND category match, newest first. Used where a strict preference
 * match is required. Empty brands or empty categories yield no matches. */
export const filterForYou = (deals, followedBrands, favoriteCategories) => {
  if (followedBrands.length === 0 || favoriteCategories.length === 0) return [];
  const brandSlugs = new Set(followedBrands.map(slugify));
  const categorySet = new Set(favoriteCategories.map((c) => c.toLowerCase()));
  const matched = deals.filter((d) => {
    if (!brandSlugs.has(d.brandId)) return false;
    const cats = [d.category, d.subcategory].filter(Boolean).map((c) => String(c).toLowerCase());
    return cats.some((c) => categorySet.has(c));
  });
  return [...matched].sort(byCreatedDesc);
};

const byCreatedDesc = (a, b) => {
  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return bTime - aTime;
};

const dealMatchesPreference = (deal, brandSlugs, categorySet) => {
  const brandOk = brandSlugs.size > 0 && brandSlugs.has(deal.brandId);
  const cats = [deal.category, deal.subcategory].filter(Boolean).map((c) => String(c).toLowerCase());
  const categoryOk = categorySet.size > 0 && cats.some((c) => categorySet.has(c));
  return brandOk || categoryOk;
};

/** Preference matches first (newest among those), then every other deal newest
 * first. No preferences, or preferences with no matching offers, still return
 * the latest deals so the feed is never empty when the catalog has offers. */
export const orderDealsByPreference = (deals, followedBrands = [], favoriteCategories = []) => {
  const brandSlugs = new Set(followedBrands.map(slugify));
  const categorySet = new Set(favoriteCategories.map((c) => String(c).toLowerCase()));
  if (brandSlugs.size === 0 && categorySet.size === 0) {
    return [...deals].sort(byCreatedDesc);
  }

  const preferred = [];
  const rest = [];
  for (const deal of deals) {
    if (dealMatchesPreference(deal, brandSlugs, categorySet)) preferred.push(deal);
    else rest.push(deal);
  }
  preferred.sort(byCreatedDesc);
  rest.sort(byCreatedDesc);
  return [...preferred, ...rest];
};

/** Derives the notification feed (newest 15 offers) from raw API offers.
 * Pass derived `brands` so brandId matches brandsById (incl. regional-name fuzzy match). */
export const deriveAlerts = (apiOffers, brands = []) => {
  const sorted = [...apiOffers].sort((a, b) => {
    const aT = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bT = b.created_at ? new Date(b.created_at).getTime() : 0;
    return bT - aT;
  });
  return sorted.slice(0, 15).map((offer, index) => {
    const isFlash = (offer.discount_percentage ?? 0) >= 30;
    const brandId = offer.brand
      ? resolveRegisteredBrandId(offer.brand, brands) || slugify(offer.brand)
      : null;
    return {
      id: `offer-alert-${offer.id}`,
      kind: isFlash ? 'flash-sale' : 'new-brand',
      title: isFlash ? `Flash Sale: ${offer.brand ?? 'New offer'}` : `New offer from ${offer.brand ?? 'a tracked brand'}`,
      body: offer.summary?.slice(0, 100) ?? (offer.discount_percentage ? `${offer.discount_percentage}% off` : 'New offer tracked'),
      time: offer.created_at ? new Date(offer.created_at).toLocaleDateString() : '',
      brandId,
      dealId: offer.id != null ? String(offer.id) : null,
      read: index >= 5,
    };
  });
};
