import {
  currentDiscountPct,
  isHttpUrl,
  isPctConditionAvailable,
  normalizeHttpUrl,
  validateAlertConditions,
  validateAlertDraft,
  validateAlertNotifications,
  validateManualProduct,
  validateProductUrl,
} from '../saleAlertValidation';

describe('saleAlertValidation', () => {
  test('isHttpUrl accepts http(s) hosts', () => {
    expect(isHttpUrl('https://shop.example.com/p/1')).toBe(true);
    expect(isHttpUrl('shop.example.com/p/1')).toBe(true);
    expect(isHttpUrl('not a url')).toBe(false);
    expect(isHttpUrl('ftp://example.com/x')).toBe(false);
  });

  test('normalizeHttpUrl adds https when missing', () => {
    expect(normalizeHttpUrl('shop.example.com/p')).toBe('https://shop.example.com/p');
    expect(normalizeHttpUrl('https://shop.example.com/p')).toBe('https://shop.example.com/p');
    expect(normalizeHttpUrl('')).toBeNull();
  });

  test('validateProductUrl requires a valid link', () => {
    expect(validateProductUrl('').ok).toBe(false);
    expect(validateProductUrl('hello').ok).toBe(false);
    expect(validateProductUrl('https://example.com/product').ok).toBe(true);
  });

  test('validateManualProduct requires name, brand, url', () => {
    const bad = validateManualProduct({
      productName: '',
      brandName: 'Nike',
      productUrl: 'https://example.com/p',
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors.productName).toBeTruthy();

    const good = validateManualProduct({
      productName: 'Air Max',
      brandName: 'Nike',
      productUrl: 'example.com/air',
      currentPrice: '120',
      originalPrice: '150',
    });
    expect(good.ok).toBe(true);
    expect(good.values.productUrl).toBe('https://example.com/air');
    expect(good.values.currentPrice).toBe(120);
  });

  test('validateManualProduct rejects original below current', () => {
    const result = validateManualProduct({
      productName: 'Air Max',
      brandName: 'Nike',
      productUrl: 'https://example.com/p',
      currentPrice: '150',
      originalPrice: '100',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.originalPrice).toBeTruthy();
  });

  test('validateAlertConditions checks custom pct and target price', () => {
    expect(
      validateAlertConditions({
        alertType: 'product',
        conditionType: 'custom_pct',
        customPct: '0',
      }).ok,
    ).toBe(false);
    expect(
      validateAlertConditions({
        alertType: 'product',
        conditionType: 'target_price',
        targetPrice: '',
      }).ok,
    ).toBe(false);
    expect(
      validateAlertConditions({
        alertType: 'product',
        conditionType: 'target_price',
        targetPrice: '99',
      }).ok,
    ).toBe(true);
    expect(
      validateAlertConditions({
        alertType: 'brand',
        conditionType: 'target_price',
      }).ok,
    ).toBe(false);
  });

  test('hides pct options at or below the live discount', () => {
    expect(currentDiscountPct(7000, 10000)).toBeCloseTo(30);
    expect(isPctConditionAvailable('any_sale', 30)).toBe(false);
    expect(isPctConditionAvailable('pct_10', 30)).toBe(false);
    expect(isPctConditionAvailable('pct_20', 30)).toBe(false);
    expect(isPctConditionAvailable('pct_30', 30)).toBe(false);
    expect(isPctConditionAvailable('custom_pct', 30)).toBe(true);
    expect(isPctConditionAvailable('pct_30', 29.9)).toBe(true);
  });

  test('blocks conditions already met by the current sale', () => {
    const tooLow = validateAlertConditions({
      alertType: 'product',
      conditionType: 'pct_30',
      currentPrice: 7000,
      originalPrice: 10000,
      alreadyOnSale: true,
    });
    expect(tooLow.ok).toBe(false);
    expect(tooLow.error).toMatch(/threshold above|already \d+% off/i);

    const customLow = validateAlertConditions({
      alertType: 'product',
      conditionType: 'custom_pct',
      customPct: 30,
      currentPrice: 7000,
      originalPrice: 10000,
      alreadyOnSale: true,
    });
    expect(customLow.ok).toBe(false);

    const customOk = validateAlertConditions({
      alertType: 'product',
      conditionType: 'custom_pct',
      customPct: 40,
      currentPrice: 7000,
      originalPrice: 10000,
      alreadyOnSale: true,
    });
    expect(customOk.ok).toBe(true);

    const targetLow = validateAlertConditions({
      alertType: 'product',
      conditionType: 'target_price',
      targetPrice: 7000,
      currentPrice: 7000,
      originalPrice: 10000,
      alreadyOnSale: true,
    });
    expect(targetLow.ok).toBe(false);
  });

  test('validateAlertNotifications requires at least one channel', () => {
    expect(
      validateAlertNotifications({
        notifyPush: false,
        notifyEmail: false,
        notifyInApp: false,
      }).ok,
    ).toBe(false);
    expect(
      validateAlertNotifications({
        notifyPush: true,
        notifyEmail: false,
        notifyInApp: false,
      }).ok,
    ).toBe(true);
  });

  test('validateAlertDraft covers full create payload', () => {
    const result = validateAlertDraft({
      alertType: 'product',
      productName: 'Shoes',
      brandName: 'Nike',
      productUrl: 'https://example.com/shoes',
      conditionType: 'any_sale',
      notifyPush: true,
      notifyEmail: false,
      notifyInApp: false,
    });
    expect(result.ok).toBe(true);
  });

  test('validateAlertDraft blocks create when condition is already met', () => {
    const result = validateAlertDraft({
      alertType: 'product',
      productName: 'Shoes',
      brandName: 'Nike',
      productUrl: 'https://example.com/shoes',
      currentPrice: 7000,
      originalPrice: 10000,
      alreadyOnSale: true,
      conditionType: 'pct_30',
      notifyPush: true,
      notifyEmail: false,
      notifyInApp: true,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/threshold above|already \d+% off/i);
  });
});
