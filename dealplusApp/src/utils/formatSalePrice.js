/** Format sale-alert amounts for PK-focused stores (scraped values are PKR). */
export const formatSalePrice = (value) => {
  if (value == null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return `Rs. ${rounded.toLocaleString('en-PK')}`;
};
