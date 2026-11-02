/** Parse a price string like "$29.99", "SAR 150", "Rs. 1,500", "AED99" → number or undefined */
export function parsePrice(raw: string | null | undefined): number | undefined {
  if (!raw) return undefined;
  // Remove currency symbols/codes, keep digits, commas, dots
  const cleaned = raw.replace(/[^\d.,]/g, "").replace(/,/g, "");
  // Handle "1.500" (European format) vs "1.50" (decimal)
  const n = parseFloat(cleaned);
  return isNaN(n) || n <= 0 ? undefined : n;
}

/** Extract currency symbol/code from a price string */
export function parseCurrency(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  // Named currency codes first
  const code = raw.match(/\b(USD|SAR|AED|PKR|EGP|QAR|KWD|EUR|GBP|INR|BDT|LKR)\b/i);
  if (code) return code[1].toUpperCase();
  // Urdu/South Asian "Rs." prefix
  const rs = raw.match(/Rs\.?/i);
  if (rs) return "Rs";
  // Symbol prefix before first digit
  const m = raw.match(/^([^\d\s.,]{1,4})/);
  if (m) return m[0].trim();
  return undefined;
}

/** Extract discount percentage from text like "30% OFF" → 30 */
export function parseDiscountPercent(text: string): number | undefined {
  const m = text.match(/(\d+(?:\.\d+)?)\s*%\s*(?:off|discount|sale)?/i);
  if (m) {
    const n = parseFloat(m[1]);
    return n > 0 && n <= 99 ? n : undefined;
  }
  return undefined;
}

/** Derive discount % from original + sale price */
export function calcDiscount(original: number, sale: number): number | undefined {
  if (original <= 0 || sale >= original) return undefined;
  return Math.round(((original - sale) / original) * 100);
}
