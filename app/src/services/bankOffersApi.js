import { appAxios } from './apiInterceptors';
import { slugify } from '../utils/dealAdapters';
import { getBankIdByTakhfifName } from '../config/banks';
import useBankOffersStore from '../state/bankOffersStore';

const CARD_TYPE_PATTERNS = [
  [/islamic/i, 'islamic'],
  [/platinum|gold/i, 'platinum'],
  [/visa|master\s*card|mastercard/i, 'visa_mc'],
  [/credit/i, 'credit'],
  [/debit/i, 'debit'],
];

const inferCardType = (cardName) => {
  if (!cardName) return 'all';
  const match = CARD_TYPE_PATTERNS.find(([pattern]) => pattern.test(cardName));
  return match ? match[1] : 'all';
};

/** Maps one scraped /api/bank-offers row onto the same shape as the static
 * BANK_CARD_OFFERS entries in config/banks.js, plus the richer fields from
 * the chrome-extension import (max discount, valid days, scraped business
 * enrichment). Returns null when the bank isn't in SUPPORTED_BANKS yet. */
const mapOffer = (row, index) => {
  const bankId = getBankIdByTakhfifName(row.bank_name);
  if (!bankId) return null;
  return {
    id: `takhfif-${row.brand_id}-${index}`,
    brandSlug: slugify(row.brand_name || ''),
    bankId,
    cardType: inferCardType(row.card_name),
    discountPercent: row.discount_percentage ?? 0,
    maxDiscount: null,
    // Rich fields from chrome-extension import
    maxDiscountText: row.max_discount_text || null,
    maxDiscountAmount: row.max_discount_amount || null,
    validDays: row.valid_days || [],
    terms: row.terms || [],
    description: row.description || row.card_name || '',
    expiryDate: row.expiry_date,
    daysValid: null,
    // Scraped business enrichment (null when not yet imported via extension)
    city: row.city || null,
    coverImageUrl: row.cover_image_url || null,
    logoUrl: row.logo_url || null,
    rating: row.rating || null,
    reviewCount: row.review_count || null,
    category: row.category || null,
    sourceUrl: row.source_url || null,
  };
};

/** Fetches the live, scraped bank-card offers (takhfif.app, via
 * scraper_server) and maps them onto the static BANK_CARD_OFFERS shape.
 * Callers merge this with the static seed array rather than replacing it —
 * see state/bankOffersStore.js. */
export const fetchBankCardOffers = async () => {
  const res = await appAxios.get('/bank-offers');
  const rows = res.data?.offers ?? [];
  return rows.map(mapOffer).filter(Boolean);
};

/** Fetches scraped businesses from takhfif.app with aggregated bank offer
 * counts — the primary data source for the Bank Offers screen. */
export const fetchScrapedBusinesses = async () => {
  const res = await appAxios.get('/bank-offers/businesses');
  return res.data?.businesses ?? [];
};

let inflight = null;

/** Fire-and-forget load into bankOffersStore — safe to call from every
 * screen that reads bank offers (BankOffersScreen, BrandDetailScreen).
 * Concurrent callers share one request; a store that already has offers
 * skips the network call entirely. Never throws — a failure just leaves
 * the store's static-only fallback in place. */
export const loadBankCardOffers = () => {
  if (inflight) return inflight;

  useBankOffersStore.getState().setLoading(true);
  inflight = fetchBankCardOffers()
    .then((offers) => useBankOffersStore.getState().setOffers(offers))
    .catch((error) => useBankOffersStore.getState().setError(error?.message ?? 'Failed to load bank offers'))
    .finally(() => { inflight = null; });
  return inflight;
};
