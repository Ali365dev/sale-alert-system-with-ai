/** `takhfifName` is the exact bank name used by takhfif.app (and therefore
 * by the scraped BankCardOffer rows from app/src/services/bankOffersApi.js)
 * — it's how a scraped offer's bank_name is resolved back to an id here. */
export const SUPPORTED_BANKS = [
  { id: 'hbl', name: 'HBL', fullName: 'Habib Bank Limited', initials: 'H', color: '#1A6830', offerCount: 847, takhfifName: 'HBL' },
  { id: 'mcb', name: 'MCB', fullName: 'Muslim Commercial Bank', initials: 'M', color: '#8B0000', offerCount: 623, takhfifName: 'MCB Bank' },
  { id: 'meezan', name: 'Meezan', fullName: 'Meezan Bank', initials: 'Mz', color: '#1B2F5E', offerCount: 512, takhfifName: 'Meezan Bank' },
  { id: 'ubl', name: 'UBL', fullName: 'United Bank Limited', initials: 'U', color: '#1A237E', offerCount: 489, takhfifName: 'UBL' },
  { id: 'alfalah', name: 'Bank Alfalah', fullName: 'Alfalah Credit & Debit', initials: 'A', color: '#7B241C', offerCount: 401, takhfifName: 'Bank Alfalah' },
  { id: 'scb', name: 'SCB', fullName: 'Standard Chartered Bank', initials: 'SC', color: '#0D47A1', offerCount: 320, takhfifName: 'Standard Chartered' },
  { id: 'habibmetro', name: 'HabibMetro', fullName: 'HabibMetro Bank', initials: 'HM', color: '#2E7D32', offerCount: 268, takhfifName: 'Habib Metro Bank' },
  { id: 'askari', name: 'Askari', fullName: 'Askari Bank', initials: 'AK', color: '#283593', offerCount: 215, takhfifName: 'Askari Bank' },
  { id: 'albaraka', name: 'Al Baraka', fullName: 'Al Baraka Bank', initials: 'AB', color: '#5D4037', offerCount: 142, takhfifName: 'Al Baraka Bank' },
  { id: 'allied', name: 'Allied Bank', fullName: 'Allied Bank Limited', initials: 'AL', color: '#B71C1C', offerCount: 198, takhfifName: 'Allied Bank' },
  { id: 'bankalhabib', name: 'Bank Al Habib', fullName: 'Bank Al Habib Limited', initials: 'BH', color: '#004D40', offerCount: 231, takhfifName: 'Bank Al Habib' },
  { id: 'bankislami', name: 'BankIslami', fullName: 'BankIslami Pakistan', initials: 'BI', color: '#4A148C', offerCount: 176, takhfifName: 'Bank Islami' },
  { id: 'bankofpunjab', name: 'Bank of Punjab', fullName: 'The Bank of Punjab', initials: 'BP', color: '#1565C0', offerCount: 189, takhfifName: 'Bank of Punjab' },
  { id: 'dib', name: 'DIB', fullName: 'Dubai Islamic Bank', initials: 'DI', color: '#006064', offerCount: 302, takhfifName: 'Dubai Islamic Bank' },
  { id: 'easypaisa', name: 'EasyPaisa', fullName: 'EasyPaisa', initials: 'EP', color: '#2E7D32', offerCount: 164, takhfifName: 'EasyPaisa' },
  { id: 'faysal', name: 'Faysal Bank', fullName: 'Faysal Bank Limited', initials: 'F', color: '#3E2723', offerCount: 157, takhfifName: 'Faysal Bank' },
  { id: 'hblislamic', name: 'HBL Islamic', fullName: 'HBL Islamic Banking', initials: 'HI', color: '#1B5E20', offerCount: 133, takhfifName: 'HBL Islamic' },
  { id: 'jsbank', name: 'JS Bank', fullName: 'JS Bank Limited', initials: 'JS', color: '#263238', offerCount: 121, takhfifName: 'JS Bank' },
  { id: 'jazzcash', name: 'JazzCash', fullName: 'JazzCash', initials: 'JC', color: '#E65100', offerCount: 148, takhfifName: 'JazzCash' },
  { id: 'mcbislamic', name: 'MCB Islamic', fullName: 'MCB Islamic Bank', initials: 'MI', color: '#5D1049', offerCount: 112, takhfifName: 'MCB Islamic' },
  { id: 'soneri', name: 'Soneri Bank', fullName: 'Soneri Bank Limited', initials: 'SN', color: '#827717', offerCount: 128, takhfifName: 'Soneri Bank' },
];

export const CARD_TYPE_LABELS = {
  all: 'All Debit & Credit Cards',
  debit: 'All Debit Cards',
  credit: 'All Credit Cards',
  visa_mc: 'Visa & MasterCard Credit',
  islamic: 'All Islamic Cards',
  platinum: 'Platinum & Gold Credit',
};

/** Static bank card offers — matched to brands by their slugified name. */
export const BANK_CARD_OFFERS = [
  // Metro Cash & Carry
  { id: 'bco-1', brandSlug: 'metro-cash-carry', bankId: 'hbl', cardType: 'all', discountPercent: 20, maxDiscount: 1500, description: 'Min transaction Rs. 3,000. Valid on grocery items only. Max discount Rs. 1,500.', expiryDate: '2024-12-31', daysValid: ['Saturday', 'Sunday'] },
  { id: 'bco-2', brandSlug: 'metro-cash-carry', bankId: 'mcb', cardType: 'visa_mc', discountPercent: 30, maxDiscount: null, description: 'Applicable on electronics & appliances. Min spend Rs. 10,000.', expiryDate: '2025-01-15', daysValid: null },
  { id: 'bco-3', brandSlug: 'metro-cash-carry', bankId: 'meezan', cardType: 'islamic', discountPercent: 15, maxDiscount: null, description: 'On all purchases. No minimum spend required.', expiryDate: null, daysValid: 'all' },
  { id: 'bco-4', brandSlug: 'metro-cash-carry', bankId: 'ubl', cardType: 'platinum', discountPercent: 25, maxDiscount: 2000, description: 'Min transaction Rs. 5,000. Valid on all categories.', expiryDate: '2024-12-15', daysValid: null },
  // KFC
  { id: 'bco-5', brandSlug: 'kfc-pakistan', bankId: 'hbl', cardType: 'all', discountPercent: 15, maxDiscount: 500, description: 'Min order Rs. 1,000. Valid on dine-in and takeaway.', expiryDate: null, daysValid: 'all' },
  { id: 'bco-6', brandSlug: 'kfc-pakistan', bankId: 'mcb', cardType: 'credit', discountPercent: 25, maxDiscount: 1000, description: 'Min order Rs. 1,500. Valid on all orders.', expiryDate: '2025-02-28', daysValid: ['Friday', 'Saturday', 'Sunday'] },
  // Daraz
  { id: 'bco-7', brandSlug: 'daraz.pk', bankId: 'hbl', cardType: 'all', discountPercent: 10, maxDiscount: 2000, description: 'Extra 10% off on all purchases. Min order Rs. 2,500.', expiryDate: '2025-01-31', daysValid: 'all' },
  { id: 'bco-8', brandSlug: 'daraz.pk', bankId: 'mcb', cardType: 'visa_mc', discountPercent: 15, maxDiscount: 1500, description: 'Visa & MasterCard. Extra 15% off. Min order Rs. 3,000.', expiryDate: '2025-01-31', daysValid: 'all' },
  { id: 'bco-9', brandSlug: 'daraz.pk', bankId: 'ubl', cardType: 'credit', discountPercent: 20, maxDiscount: 2500, description: '20% off on fashion & electronics.', expiryDate: '2025-02-28', daysValid: 'all' },
  // Careem
  { id: 'bco-10', brandSlug: 'careem', bankId: 'hbl', cardType: 'all', discountPercent: 25, maxDiscount: 300, description: 'Get 25% off on your next ride. Min fare Rs. 300.', expiryDate: null, daysValid: 'all' },
  { id: 'bco-11', brandSlug: 'careem', bankId: 'meezan', cardType: 'islamic', discountPercent: 15, maxDiscount: 200, description: 'Islamic card holders get extra 15% cashback.', expiryDate: '2025-03-31', daysValid: 'all' },
  // Pizza Hut
  { id: 'bco-12', brandSlug: 'pizza-hut', bankId: 'ubl', cardType: 'all', discountPercent: 20, maxDiscount: 800, description: 'Min order Rs. 2,000. Valid on delivery and dine-in.', expiryDate: '2025-01-31', daysValid: null },
  { id: 'bco-13', brandSlug: 'pizza-hut', bankId: 'alfalah', cardType: 'credit', discountPercent: 15, maxDiscount: 500, description: 'All Bank Alfalah credit cards. Min order Rs. 1,500.', expiryDate: null, daysValid: ['Friday', 'Saturday', 'Sunday'] },
  // Foodpanda
  { id: 'bco-14', brandSlug: 'foodpanda', bankId: 'scb', cardType: 'credit', discountPercent: 30, maxDiscount: 1000, description: 'SCB credit card holders get 30% off. Min order Rs. 1,000.', expiryDate: '2025-01-31', daysValid: 'all' },
  { id: 'bco-15', brandSlug: 'foodpanda', bankId: 'hbl', cardType: 'all', discountPercent: 20, maxDiscount: 600, description: 'All HBL cards. Min order Rs. 800. Max discount Rs. 600.', expiryDate: null, daysValid: null },
  // Outfitters
  { id: 'bco-16', brandSlug: 'outfitters', bankId: 'mcb', cardType: 'all', discountPercent: 15, maxDiscount: 1500, description: 'All MCB cards. On all purchases. Min Rs. 3,000.', expiryDate: null, daysValid: null },
  { id: 'bco-17', brandSlug: 'outfitters', bankId: 'meezan', cardType: 'islamic', discountPercent: 10, maxDiscount: 1000, description: 'Islamic cards. Valid on all in-store and online orders.', expiryDate: '2025-03-31', daysValid: 'all' },
  // Gul Ahmed
  { id: 'bco-18', brandSlug: 'gul-ahmed', bankId: 'hbl', cardType: 'debit', discountPercent: 10, maxDiscount: 1000, description: 'HBL Debit Card holders. On all orders above Rs. 2,500.', expiryDate: '2025-02-28', daysValid: 'all' },
  { id: 'bco-19', brandSlug: 'gul-ahmed', bankId: 'alfalah', cardType: 'credit', discountPercent: 20, maxDiscount: 2000, description: 'Bank Alfalah credit cards. Min purchase Rs. 5,000.', expiryDate: null, daysValid: null },
  // Gulabo
  { id: 'bco-20', brandSlug: 'gulabo', bankId: 'mcb', cardType: 'visa_mc', discountPercent: 25, maxDiscount: 1500, description: 'MCB Visa & MasterCard. On all fashion items. Min Rs. 2,000.', expiryDate: '2025-02-28', daysValid: ['Saturday', 'Sunday'] },
];

export const getBankById = (id) => SUPPORTED_BANKS.find((b) => b.id === id);

/** Every helper below takes an optional `offers` override (defaulting to
 * the static seed array) so a screen that has merged in live, scraped
 * offers (see services/bankOffersApi.js + state/bankOffersStore.js) can
 * pass that combined array through instead. */

export const getOffersForBrand = (brandSlug, offers = BANK_CARD_OFFERS) =>
  offers.filter((o) => o.brandSlug === brandSlug);

export const getMaxDiscountForBrand = (brandSlug, bankId = null, offers = BANK_CARD_OFFERS) => {
  const matched = offers.filter(
    (o) => o.brandSlug === brandSlug && (!bankId || o.bankId === bankId),
  );
  if (!matched.length) return null;
  return Math.max(...matched.map((o) => o.discountPercent));
};

export const getBrandSlugsForBank = (bankId, offers = BANK_CARD_OFFERS) => [
  ...new Set(offers.filter((o) => o.bankId === bankId).map((o) => o.brandSlug)),
];

export const getBankIdByTakhfifName = (takhfifName) =>
  SUPPORTED_BANKS.find((b) => b.takhfifName === takhfifName)?.id ?? null;
