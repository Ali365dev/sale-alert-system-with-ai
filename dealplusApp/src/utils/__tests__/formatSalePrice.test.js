import { formatSalePrice } from '../formatSalePrice';

describe('formatSalePrice', () => {
  test('formats PKR amounts with Rs. prefix', () => {
    expect(formatSalePrice(3149)).toBe('Rs. 3,149');
    expect(formatSalePrice('4499')).toBe('Rs. 4,499');
  });

  test('returns null for empty values', () => {
    expect(formatSalePrice(null)).toBeNull();
    expect(formatSalePrice(undefined)).toBeNull();
    expect(formatSalePrice('')).toBeNull();
    expect(formatSalePrice('abc')).toBeNull();
  });
});
