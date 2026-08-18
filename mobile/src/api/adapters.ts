import { Brand, Deal } from '@/types/dealpulse';

import { ApiBrand, ApiOffer } from './types';

// No image data exists on the backend — every image below is a category-keyed
// placeholder, not real brand/offer photography.
const CATEGORY_IMAGE_QUERIES: { match: RegExp; query: string }[] = [
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

export function imageForCategory(category: string | null | undefined): string {
  const match = category ? CATEGORY_IMAGE_QUERIES.find((c) => c.match.test(category)) : undefined;
  return `https://images.unsplash.com/${match?.query ?? DEFAULT_IMAGE_QUERY}?w=1200&q=80`;
}

export function initialsForName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function mapApiBrandToBrand(apiBrand: ApiBrand, dealCount: number): Brand {
  const category = apiBrand.categories[0] ?? 'General';
  return {
    id: slugify(apiBrand.name) || String(apiBrand.id),
    name: apiBrand.name,
    initials: initialsForName(apiBrand.name),
    color: '#171717',
    category,
    dealCount,
    description: apiBrand.website
      ? `Tracked offers from ${apiBrand.name} (${apiBrand.website}).`
      : `Tracked offers from ${apiBrand.name}.`,
    coverImage: imageForCategory(category),
    website: apiBrand.website,
  };
}

/** Synthesizes an unregistered "brand" placeholder for offers whose brand name has no Brand row. */
export function syntheticBrand(name: string, category: string | null, dealCount: number, website: string | null = null): Brand {
  return {
    id: slugify(name),
    name,
    initials: initialsForName(name),
    color: '#171717',
    category: category ?? 'General',
    dealCount,
    description: `Tracked offers from ${name}.`,
    coverImage: imageForCategory(category),
    website,
  };
}

export function mapApiOfferToDeal(offer: ApiOffer, brandId: string): Deal {
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
    image: imageForCategory(offer.category),
    category: offer.category ?? 'General',
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
}
