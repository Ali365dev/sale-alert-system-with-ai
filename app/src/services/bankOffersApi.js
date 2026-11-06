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
 * BANK_CARD_OFFERS entries in config/banks.js. Returns null when the bank
 * isn't in SUPPORTED_BANKS yet, so an unrecognized name is skipped rather
 * than rendered with a broken bankId. */
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
    description: row.description || row.card_name || '',
    expiryDate: row.expiry_date,
    daysValid: null,
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

let inflight = null;

/** Fire-and-forget load into bankOffersStore — safe to call from every
 * screen that reads bank offers (BankOffersScreen, BrandDetailScreen).
 * Concurrent callers share one request; a store that already has offers
 * skips the network call entirely. Never throws — a failure just leaves
 * the store's static-only fallback in place. */
export const loadBankCardOffers = () => {
  if (inflight) return inflight;
  if (useBankOffersStore.getState().offers.length > 0) return Promise.resolve();

  useBankOffersStore.getState().setLoading(true);
  inflight = fetchBankCardOffers()
    .then((offers) => useBankOffersStore.getState().setOffers(offers))
    .catch((error) => useBankOffersStore.getState().setError(error?.message ?? 'Failed to load bank offers'))
    .finally(() => { inflight = null; });
  return inflight;
};
