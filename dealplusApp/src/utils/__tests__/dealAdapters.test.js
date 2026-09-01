import {
  deriveAlerts,
  deriveBrandsAndDeals,
  deriveCategories,
  filterForYou,
  iconForCategory,
  imageForCategory,
  initialsForName,
  mapApiBrandToBrand,
  mapApiOfferToDeal,
  slugify,
  syntheticBrand,
} from '../dealAdapters';

describe('slugify', () => {
  test('lowercases and hyphenates', () => {
    expect(slugify('Junaid Jamshed (J.)')).toBe('junaid-jamshed-j');
  });

  test('trims leading/trailing hyphens produced by punctuation', () => {
    expect(slugify('!Acme!')).toBe('acme');
  });

  test('collapses runs of non-alphanumeric characters into a single hyphen', () => {
    expect(slugify('A   B---C')).toBe('a-b-c');
  });
});

describe('initialsForName', () => {
  test('two-word name uses first letter of each word', () => {
    expect(initialsForName('Acme Corp')).toBe('AC');
  });

  test('single word uses its first two letters', () => {
    expect(initialsForName('Nike')).toBe('NI');
  });

  test('empty/whitespace-only name falls back to "?"', () => {
    expect(initialsForName('   ')).toBe('?');
  });
});

describe('iconForCategory / imageForCategory', () => {
  test('matches a known category to its icon', () => {
    expect(iconForCategory('Footwear')).toBe('shoe-sneaker');
  });

  test('falls back to a generic tag icon for an unknown category', () => {
    expect(iconForCategory('Some Weird Category')).toBe('tag-outline');
  });

  test('imageForCategory never throws for a null/undefined category and returns a URL', () => {
    expect(imageForCategory(undefined)).toMatch(/^https:\/\/images\.unsplash\.com\//);
    expect(imageForCategory(null)).toMatch(/^https:\/\/images\.unsplash\.com\//);
  });
});

describe('mapApiBrandToBrand', () => {
  test('maps core fields and derives id/initials from the name', () => {
    const brand = mapApiBrandToBrand({ id: 1, name: 'Acme Corp', categories: ['Fashion'], website: 'https://acme.com' }, 3);
    expect(brand.id).toBe('acme-corp');
    expect(brand.initials).toBe('AC');
    expect(brand.category).toBe('Fashion');
    expect(brand.dealCount).toBe(3);
    expect(brand.website).toBe('https://acme.com');
  });

  test('brand with no categories falls back to "General"', () => {
    const brand = mapApiBrandToBrand({ id: 2, name: 'NoCat', categories: [] }, 0);
    expect(brand.category).toBe('General');
  });

  test('description mentions the website only when one exists', () => {
    const withSite = mapApiBrandToBrand({ id: 1, name: 'Acme', categories: [], website: 'https://acme.com' }, 0);
    const withoutSite = mapApiBrandToBrand({ id: 2, name: 'Acme2', categories: [], website: null }, 0);
    expect(withSite.description).toContain('https://acme.com');
    expect(withoutSite.description).not.toContain('null');
  });
});

describe('mapApiOfferToDeal', () => {
  test('percentage discount formats as "-N%"', () => {
    const deal = mapApiOfferToDeal({ id: 1, discount_percentage: 25.6, brand: 'Acme' }, 'acme');
    expect(deal.discountLabel).toBe('-26%');
    expect(deal.isPercentageOff).toBe(true);
  });

  test('non-percentage offer falls back to the uppercased offer_type', () => {
    const deal = mapApiOfferToDeal({ id: 1, offer_type: 'bogo', brand: 'Acme' }, 'acme');
    expect(deal.discountLabel).toBe('BOGO');
    expect(deal.isPercentageOff).toBe(false);
  });

  test('offer with neither discount_percentage nor offer_type falls back to "DEAL"', () => {
    const deal = mapApiOfferToDeal({ id: 1, brand: 'Acme' }, 'acme');
    expect(deal.discountLabel).toBe('DEAL');
  });

  test('prefers the source email subject (title) over a derived one', () => {
    const deal = mapApiOfferToDeal({ id: 1, title: 'Original Subject Line', summary: 'A summary.', brand: 'Acme' }, 'acme');
    expect(deal.title).toBe('Original Subject Line');
  });

  test('falls back to the first sentence of the summary when there is no title', () => {
    const deal = mapApiOfferToDeal({ id: 1, title: null, summary: 'First sentence. Second sentence.', brand: 'Acme' }, 'acme');
    expect(deal.title).toBe('First sentence.');
  });

  test('falls back to a synthesized title when there is no title or summary', () => {
    const deal = mapApiOfferToDeal({ id: 1, title: null, summary: null, discount_percentage: 10, brand: 'Acme' }, 'acme');
    expect(deal.title).toBe('Acme offer — -10%');
  });

  test('isFlashSale is true at and above 30% off, false below', () => {
    expect(mapApiOfferToDeal({ id: 1, discount_percentage: 30 }, 'x').isFlashSale).toBe(true);
    expect(mapApiOfferToDeal({ id: 1, discount_percentage: 29 }, 'x').isFlashSale).toBe(false);
    expect(mapApiOfferToDeal({ id: 1 }, 'x').isFlashSale).toBe(false);
  });

  test('isFeatured is true only when verification_status is "verified"', () => {
    expect(mapApiOfferToDeal({ id: 1, verification_status: 'verified' }, 'x').isFeatured).toBe(true);
    expect(mapApiOfferToDeal({ id: 1, verification_status: 'suspicious' }, 'x').isFeatured).toBe(false);
    expect(mapApiOfferToDeal({ id: 1, verification_status: null }, 'x').isFeatured).toBe(false);
  });
});

describe('deriveBrandsAndDeals', () => {
  const apiBrands = [{ id: 1, name: 'Acme', categories: ['Fashion'], website: 'https://acme.com' }];

  test('counts offers per registered brand by slugified name match', () => {
    const apiOffers = [
      { id: 1, brand: 'Acme', category: 'Fashion' },
      { id: 2, brand: 'Acme', category: 'Fashion' },
    ];
    const { brands, deals } = deriveBrandsAndDeals(apiBrands, apiOffers);
    expect(brands.find((b) => b.id === 'acme').dealCount).toBe(2);
    expect(deals).toHaveLength(2);
  });

  test('an offer from an unregistered brand gets a synthetic brand placeholder', () => {
    const apiOffers = [{ id: 1, brand: 'Unregistered Co', category: 'Tech', website: 'https://unreg.co' }];
    const { brands, brandsById } = deriveBrandsAndDeals(apiBrands, apiOffers);
    expect(brands).toHaveLength(2);
    const synthetic = brandsById['unregistered-co'];
    expect(synthetic).toBeDefined();
    expect(synthetic.website).toBe('https://unreg.co');
  });

  test('two offers from the same unregistered brand only produce one synthetic brand, not two', () => {
    const apiOffers = [
      { id: 1, brand: 'Unregistered Co', category: 'Tech' },
      { id: 2, brand: 'Unregistered Co', category: 'Tech' },
    ];
    const { brands } = deriveBrandsAndDeals(apiBrands, apiOffers);
    expect(brands.filter((b) => b.id === 'unregistered-co')).toHaveLength(1);
  });

  test('an offer with no brand at all is excluded from deals entirely', () => {
    const apiOffers = [{ id: 1, brand: null, category: 'Tech' }];
    const { deals } = deriveBrandsAndDeals(apiBrands, apiOffers);
    expect(deals).toHaveLength(0);
  });

  test('empty brands and offers produce empty, well-formed output (no crash)', () => {
    const result = deriveBrandsAndDeals([], []);
    expect(result.brands).toEqual([]);
    expect(result.deals).toEqual([]);
    expect(result.brandsById).toEqual({});
  });
});

describe('deriveCategories', () => {
  test('counts and sorts categories by deal count, descending', () => {
    const offers = [{ category: 'Fashion' }, { category: 'Tech' }, { category: 'Fashion' }, { category: 'Fashion' }];
    const categories = deriveCategories(offers);
    expect(categories[0]).toMatchObject({ name: 'Fashion', dealCount: 3 });
    expect(categories[1]).toMatchObject({ name: 'Tech', dealCount: 1 });
  });

  test('offers with no category are ignored, not counted as a blank category', () => {
    const categories = deriveCategories([{ category: null }, { category: undefined }, {}]);
    expect(categories).toEqual([]);
  });
});

describe('filterForYou', () => {
  const deals = [
    { id: '1', brandId: 'nike', category: 'Footwear', createdAt: '2026-01-01T00:00:00Z' },
    { id: '2', brandId: 'acme', category: 'Fashion', createdAt: '2026-03-01T00:00:00Z' },
    { id: '3', brandId: 'other', category: 'Tech', createdAt: '2026-02-01T00:00:00Z' },
  ];

  test('returns empty when the user has no followed brands or favorite categories', () => {
    expect(filterForYou(deals, [], [])).toEqual([]);
  });

  test('matches a deal via followed brand OR favorite category (any-overlap, not requiring both)', () => {
    const byBrand = filterForYou(deals, ['Nike'], []);
    expect(byBrand.map((d) => d.id)).toEqual(['1']);

    const byCategory = filterForYou(deals, [], ['Tech']);
    expect(byCategory.map((d) => d.id)).toEqual(['3']);
  });

  test('a deal matching both a followed brand and a favorite category is not duplicated', () => {
    const result = filterForYou(deals, ['Nike'], ['Footwear']);
    expect(result.filter((d) => d.id === '1')).toHaveLength(1);
  });

  test('followed brand names are matched via the same slugify used for brandId', () => {
    // "Nike" -> slug "nike", matching deals[0].brandId exactly.
    const result = filterForYou(deals, ['Nike'], []);
    expect(result).toHaveLength(1);
  });

  test('results are sorted newest first', () => {
    const result = filterForYou(deals, ['Nike', 'Acme'], []);
    expect(result.map((d) => d.id)).toEqual(['2', '1']);
  });

  test('a deal with no matching brand or category is excluded', () => {
    const result = filterForYou(deals, ['Nonexistent Brand'], ['Nonexistent Category']);
    expect(result).toEqual([]);
  });
});

describe('deriveAlerts', () => {
  const makeOffers = (n) =>
    Array.from({ length: n }, (_, i) => ({
      id: i,
      brand: `Brand${i}`,
      created_at: new Date(2026, 0, i + 1).toISOString(),
      discount_percentage: i === 0 ? 40 : 5,
    }));

  test('caps the feed at the 15 newest offers', () => {
    const alerts = deriveAlerts(makeOffers(20));
    expect(alerts).toHaveLength(15);
  });

  test('sorts newest-created first', () => {
    const offers = [
      { id: 1, brand: 'A', created_at: '2026-01-01T00:00:00Z' },
      { id: 2, brand: 'B', created_at: '2026-06-01T00:00:00Z' },
    ];
    const alerts = deriveAlerts(offers);
    expect(alerts[0].id).toBe('offer-alert-2');
  });

  test('marks an offer >=30% off as a flash-sale alert, others as new-brand', () => {
    const offers = [
      { id: 1, brand: 'A', discount_percentage: 40, created_at: '2026-01-01T00:00:00Z' },
      { id: 2, brand: 'B', discount_percentage: 10, created_at: '2026-01-02T00:00:00Z' },
    ];
    const alerts = deriveAlerts(offers);
    expect(alerts.find((a) => a.id === 'offer-alert-1').kind).toBe('flash-sale');
    expect(alerts.find((a) => a.id === 'offer-alert-2').kind).toBe('new-brand');
  });

  test('only the first 5 (newest) alerts are unread; the rest are read', () => {
    const alerts = deriveAlerts(makeOffers(10));
    expect(alerts.slice(0, 5).every((a) => a.read === false)).toBe(true);
    expect(alerts.slice(5).every((a) => a.read === true)).toBe(true);
  });

  test('an offer with no brand still produces an alert with a null brandId (not a crash)', () => {
    const alerts = deriveAlerts([{ id: 1, brand: null, created_at: '2026-01-01T00:00:00Z' }]);
    expect(alerts[0].brandId).toBeNull();
  });

  test('empty input produces an empty feed', () => {
    expect(deriveAlerts([])).toEqual([]);
  });
});

describe('syntheticBrand', () => {
  test('defaults category to "General" when none is given', () => {
    expect(syntheticBrand('Some Brand', null, 1).category).toBe('General');
  });

  test('website defaults to null when not provided', () => {
    expect(syntheticBrand('Some Brand', 'Tech', 1).website).toBeNull();
  });
});
