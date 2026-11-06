export const REGIONS = {
  PK: {
    name: 'Pakistan',
    flag: '🇵🇰',
    currency: 'PKR',
    currencySymbol: 'Rs',
    locale: 'en-PK',
    rtl: false,
    isoCode: 'PK',
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
  QA: {
    name: 'Qatar',
    flag: '🇶🇦',
    currency: 'QAR',
    currencySymbol: '﷼',
    locale: 'ar-QA',
    rtl: true,
    isoCode: 'QA',
    localeTags: ['QA'],
  },
  KW: {
    name: 'Kuwait',
    flag: '🇰🇼',
    currency: 'KWD',
    currencySymbol: 'KD',
    locale: 'ar-KW',
    rtl: true,
    isoCode: 'KW',
    localeTags: ['KW'],
  },
  OM: {
    name: 'Oman',
    flag: '🇴🇲',
    currency: 'OMR',
    currencySymbol: 'ر.ع',
    locale: 'ar-OM',
    rtl: true,
    isoCode: 'OM',
    localeTags: ['OM'],
  },
  BH: {
    name: 'Bahrain',
    flag: '🇧🇭',
    currency: 'BHD',
    currencySymbol: 'BD',
    locale: 'ar-BH',
    rtl: true,
    isoCode: 'BH',
    localeTags: ['BH'],
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
};

export const DEFAULT_REGION = 'PK';

/** Returns the REGIONS entry for a given ISO code, or the default. */
export const getRegion = (isoCode) =>
  REGIONS[isoCode?.toUpperCase()] ?? REGIONS[DEFAULT_REGION];

/** All region codes we support. */
export const SUPPORTED_CODES = Object.keys(REGIONS);
