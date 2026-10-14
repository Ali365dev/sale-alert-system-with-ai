/** Client-side validation for the Sale Alerts create/edit flow. */

const PRODUCT_CONDITIONS = new Set([
  'any_sale',
  'pct_10',
  'pct_20',
  'pct_30',
  'custom_pct',
  'target_price',
]);

const BRAND_CONDITIONS = new Set([
  'any_sale',
  'pct_10',
  'pct_20',
  'pct_30',
  'new_promotion',
  'new_code',
]);

const PCT_OPTION_THRESHOLDS = {
  pct_10: 10,
  pct_20: 20,
  pct_30: 30,
};

const MAX_NAME = 300;
const MAX_URL = 2000;

/** Current discount % from was/now prices, or null. */
export const currentDiscountPct = (currentPrice, originalPrice) => {
  const cur = Number(currentPrice);
  const orig = Number(originalPrice);
  if (!Number.isFinite(cur) || !Number.isFinite(orig) || orig <= 0 || cur >= orig) return null;
  return (1 - cur / orig) * 100;
};

/** Fixed % threshold for a condition id, or null for non-% conditions. */
export const conditionPctThreshold = (conditionType, customPct) => {
  const ct = String(conditionType || '').trim();
  if (ct in PCT_OPTION_THRESHOLDS) return PCT_OPTION_THRESHOLDS[ct];
  if (ct === 'custom_pct') {
    const n = typeof customPct === 'number' ? customPct : Number(String(customPct ?? '').trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/**
 * When the product is already discounted, only allow thresholds strictly above
 * the current discount (or a target price below today's price).
 */
export const validateConditionAgainstCurrentSale = ({
  conditionType,
  customPct,
  targetPrice,
  currentPrice,
  originalPrice,
  alreadyOnSale,
}) => {
  const onSale =
    alreadyOnSale === true ||
    (currentDiscountPct(currentPrice, originalPrice) != null &&
      currentDiscountPct(currentPrice, originalPrice) > 0);
  if (!onSale) return { ok: true };

  const livePct = currentDiscountPct(currentPrice, originalPrice);
  const ct = String(conditionType || '').trim();

  if (ct === 'any_sale') {
    return {
      ok: false,
      error: `This product is already ${Math.round(livePct)}% off. Please select a threshold above ${Math.round(livePct)}% so we can notify you when the discount improves.`,
      errors: { conditionType: 'Select a threshold above the current discount.' },
    };
  }

  const threshold = conditionPctThreshold(ct, customPct);
  if (threshold != null && livePct != null) {
    // Must be strictly above the live discount (e.g. 30% off → need > 30).
    if (threshold <= livePct + 1e-9) {
      const need = Math.min(99, Math.floor(livePct) + 1);
      return {
        ok: false,
        error: `This product is already ${Math.round(livePct)}% off. Please choose a threshold above ${Math.round(livePct)}% (for example ${need}% or higher).`,
        errors: {
          conditionType: `Select a threshold above ${Math.round(livePct)}%.`,
          customPct: ct === 'custom_pct' ? `Enter a value above ${Math.round(livePct)}%.` : undefined,
        },
      };
    }
  }

  if (ct === 'target_price') {
    const cur = Number(currentPrice);
    const target = typeof targetPrice === 'number' ? targetPrice : Number(String(targetPrice ?? '').trim());
    if (Number.isFinite(cur) && Number.isFinite(target) && target >= cur) {
      return {
        ok: false,
        error: `The current price is Rs. ${Math.round(cur).toLocaleString('en-PK')}. Please enter a lower target price to continue.`,
        errors: { targetPrice: 'Enter an amount below the current price.' },
      };
    }
  }

  return { ok: true };
};

/** Filter condition option ids that are already satisfied by the live discount. */
export const isPctConditionAvailable = (conditionId, livePct) => {
  if (livePct == null || !(livePct > 0)) return true;
  if (conditionId === 'any_sale') return false;
  const threshold = PCT_OPTION_THRESHOLDS[conditionId];
  if (threshold == null) return true;
  return threshold > livePct;
};

export const isHttpUrl = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return false;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    if (!parsed.hostname || !parsed.hostname.includes('.')) return false;
    return true;
  } catch {
    return false;
  }
};

/** Normalize user input to an absolute http(s) URL, or null if invalid. */
export const normalizeHttpUrl = (value) => {
  const trimmed = String(value || '').trim();
  if (!trimmed || !isHttpUrl(trimmed)) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const parseNonNegativeNumber = (value, label) => {
  if (value == null || value === '') return { ok: true, value: null };
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return { ok: false, error: `${label} must be a valid number.` };
  if (n < 0) return { ok: false, error: `${label} cannot be negative.` };
  return { ok: true, value: n };
};

export const validateProductUrl = (url) => {
  const trimmed = String(url || '').trim();
  if (!trimmed) return { ok: false, error: 'Paste a product link to continue.' };
  if (trimmed.length > MAX_URL) return { ok: false, error: 'Product URL is too long.' };
  if (!isHttpUrl(trimmed)) {
    return { ok: false, error: 'Enter a valid product URL (e.g. https://shop.com/product).' };
  }
  return { ok: true, value: normalizeHttpUrl(trimmed) };
};

export const validateManualProduct = ({
  productName,
  brandName,
  productUrl,
  currentPrice,
  originalPrice,
  imageUrl,
}) => {
  const errors = {};

  const name = String(productName || '').trim();
  if (!name) errors.productName = 'Product name is required.';
  else if (name.length > MAX_NAME) errors.productName = 'Product name is too long.';

  const brand = String(brandName || '').trim();
  if (!brand) errors.brandName = 'Brand is required.';
  else if (brand.length > MAX_NAME) errors.brandName = 'Brand name is too long.';

  const urlResult = validateProductUrl(productUrl);
  if (!urlResult.ok) errors.productUrl = urlResult.error;

  const cur = parseNonNegativeNumber(currentPrice, 'Current price');
  if (!cur.ok) errors.currentPrice = cur.error;

  const orig = parseNonNegativeNumber(originalPrice, 'Original price');
  if (!orig.ok) errors.originalPrice = orig.error;

  if (cur.ok && orig.ok && cur.value != null && orig.value != null && orig.value < cur.value) {
    errors.originalPrice = 'Original price should be greater than or equal to current price.';
  }

  const img = String(imageUrl || '').trim();
  if (img) {
    if (img.length > MAX_URL) errors.imageUrl = 'Image URL is too long.';
    else if (!isHttpUrl(img)) errors.imageUrl = 'Enter a valid image URL.';
  }

  const firstError = Object.values(errors)[0] || null;
  return {
    ok: !firstError,
    error: firstError,
    errors,
    values: {
      productName: name,
      brandName: brand,
      productUrl: urlResult.ok ? urlResult.value : String(productUrl || '').trim(),
      currentPrice: cur.ok ? cur.value : null,
      originalPrice: orig.ok ? orig.value : null,
      imageUrl: img ? normalizeHttpUrl(img) || img : '',
    },
  };
};

export const validateAlertConditions = ({
  alertType,
  conditionType,
  customPct,
  targetPrice,
  currentPrice,
  originalPrice,
  alreadyOnSale,
}) => {
  const type = alertType === 'brand' ? 'brand' : 'product';
  const allowed = type === 'brand' ? BRAND_CONDITIONS : PRODUCT_CONDITIONS;
  const ct = String(conditionType || '').trim();

  if (!allowed.has(ct)) {
    return { ok: false, error: 'Choose a valid alert condition.', errors: { conditionType: 'Choose a valid alert condition.' } };
  }

  let values;
  if (ct === 'custom_pct') {
    const n = typeof customPct === 'number' ? customPct : Number(String(customPct ?? '').trim());
    if (!Number.isFinite(n) || n < 1 || n > 99) {
      return {
        ok: false,
        error: 'Enter a discount between 1 and 99%.',
        errors: { customPct: 'Enter a discount between 1 and 99%.' },
      };
    }
    values = { conditionType: ct, customPct: n, targetPrice: null };
  } else if (ct === 'target_price') {
    const n = typeof targetPrice === 'number' ? targetPrice : Number(String(targetPrice ?? '').trim());
    if (!Number.isFinite(n) || n <= 0) {
      return {
        ok: false,
        error: 'Enter a target price greater than 0.',
        errors: { targetPrice: 'Enter a target price greater than 0.' },
      };
    }
    values = { conditionType: ct, customPct: null, targetPrice: n };
  } else {
    values = { conditionType: ct, customPct: null, targetPrice: null };
  }

  if (type === 'product') {
    const againstSale = validateConditionAgainstCurrentSale({
      conditionType: values.conditionType,
      customPct: values.customPct,
      targetPrice: values.targetPrice,
      currentPrice,
      originalPrice,
      alreadyOnSale,
    });
    if (!againstSale.ok) return againstSale;
  }

  return { ok: true, values };
};

export const validateAlertNotifications = ({ notifyPush, notifyEmail, notifyInApp }) => {
  if (!notifyPush && !notifyEmail && !notifyInApp) {
    return {
      ok: false,
      error: 'Turn on at least one notification method.',
      errors: { notifications: 'Turn on at least one notification method.' },
    };
  }
  return { ok: true };
};

export const validateAlertDraft = (draft) => {
  if (!draft?.alertType || !['product', 'brand'].includes(draft.alertType)) {
    return { ok: false, error: 'Choose whether this is a product or brand alert.' };
  }

  if (draft.alertType === 'brand') {
    const brand = String(draft.brandName || '').trim();
    if (!brand) return { ok: false, error: 'Select a brand to continue.' };
    if (brand.length > MAX_NAME) return { ok: false, error: 'Brand name is too long.' };
  } else {
    const product = validateManualProduct({
      productName: draft.productName,
      brandName: draft.brandName,
      productUrl: draft.productUrl,
      currentPrice: draft.currentPrice,
      originalPrice: draft.originalPrice,
      imageUrl: draft.imageUrl,
    });
    if (!product.ok) return { ok: false, error: product.error, errors: product.errors };
  }

  const conditions = validateAlertConditions({
    alertType: draft.alertType,
    conditionType: draft.conditionType,
    customPct: draft.customPct,
    targetPrice: draft.targetPrice,
    currentPrice: draft.currentPrice,
    originalPrice: draft.originalPrice,
    alreadyOnSale: draft.alreadyOnSale,
  });
  if (!conditions.ok) return conditions;

  const notifications = validateAlertNotifications({
    notifyPush: draft.notifyPush,
    notifyEmail: draft.notifyEmail,
    notifyInApp: draft.notifyInApp,
  });
  if (!notifications.ok) return notifications;

  return { ok: true };
};
