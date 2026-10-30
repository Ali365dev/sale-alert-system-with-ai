export const REGIONS = {
  PK: {
    name: 'Pakistan',
    flag: '🇵🇰',
    currency: 'PKR',
    currencySymbol: 'Rs',
    locale: 'en-PK',
    rtl: false,
    isoCode: 'PK',
    // BCP-47 region subtags that map to this country
    localeTags: ['PK'],
  },
  SA: {
    name: 'Saudi Arabia',
    flag: '🇸🇦',
    currency: 'SAR',
    currencySymbol: '﷼',
    locale: 'ar-SA',
    rtl: true,
    isoCode: 'SA',
    localeTags: ['SA'],
  },
  AE: {
    name: 'UAE',
    flag: '🇦🇪',
    currency: 'AED',
    currencySymbol: 'د.إ',
    locale: 'ar-AE',
    rtl: true,
    isoCode: 'AE',
    localeTags: ['AE'],
  },
  EG: {
    name: 'Egypt',
    flag: '🇪🇬',
    currency: 'EGP',
    currencySymbol: 'E£',
    locale: 'ar-EG',
    rtl: true,
    isoCode: 'EG',
    localeTags: ['EG'],
  },
  IN: {
    name: 'India',
    flag: '🇮🇳',
    currency: 'INR',
    currencySymbol: '₹',
    locale: 'en-IN',
    rtl: false,
    isoCode: 'IN',
    localeTags: ['IN'],
  },
  TR: {
    name: 'Turkey',
    flag: '🇹🇷',
    currency: 'TRY',
    currencySymbol: '₺',
    locale: 'tr-TR',
    rtl: false,
    isoCode: 'TR',
    localeTags: ['TR'],
  },
  GB: {
    name: 'UK',
    flag: '🇬🇧',
    currency: 'GBP',
    currencySymbol: '£',
    locale: 'en-GB',
    rtl: false,
    isoCode: 'GB',
    localeTags: ['GB'],
  },
  US: {
    name: 'USA',
    flag: '🇺🇸',
    currency: 'USD',
    currencySymbol: '$',
    locale: 'en-US',
    rtl: false,
    isoCode: 'US',
    localeTags: ['US'],
  },
};

export const DEFAULT_REGION = 'PK';

/** Returns the REGIONS entry for a given ISO code, or the default. */
export const getRegion = (isoCode) =>
  REGIONS[isoCode?.toUpperCase()] ?? REGIONS[DEFAULT_REGION];

/** All region codes we support. */
export const SUPPORTED_CODES = Object.keys(REGIONS);
