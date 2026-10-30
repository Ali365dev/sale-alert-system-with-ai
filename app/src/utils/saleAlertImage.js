/** Resolve a sale-alert thumbnail: product image, else catalog brand logo. */

const normalizeBrandKey = (value) => String(value || '').trim().toLowerCase();

export const findBrandLogo = (brandName, brands = []) => {
  const key = normalizeBrandKey(brandName);
  if (!key || !Array.isArray(brands) || brands.length === 0) return null;
  const match = brands.find((b) => normalizeBrandKey(b?.name) === key);
  if (!match) return null;
  return match.logoUrl || match.logo_url || null;
};

/** Primary product image when present; otherwise brand logo. */
export const resolveSaleAlertImage = (item, brands = []) => {
  const { uri, fallbackUri } = resolveSaleAlertImageSources(item, brands);
  return uri || fallbackUri || null;
};

/**
 * Split product image vs brand-logo fallback so the UI can retry the logo
 * when the product CDN URL fails (common with http:// Shopify hosts on iOS).
 */
export const resolveSaleAlertImageSources = (item, brands = []) => {
  if (!item) return { uri: null, fallbackUri: null };
  const uri = item.image_url || item.imageUrl || null;
  const fallbackUri = findBrandLogo(item.brand_name || item.brandName, brands);
  // Avoid passing the same URL twice when the stored image already is the logo.
  if (uri && fallbackUri && uri === fallbackUri) {
    return { uri, fallbackUri: null };
  }
  return { uri, fallbackUri };
};
