import type { TakhfifBankOffers, TakhfifBusinessDetail, TakhfifOfferTier } from "../../types/takhfif";

interface LdOffer {
  description?: string;
  discount?: number;
  priceCurrency?: string;
  validThrough?: string;
  offeredBy?: { name?: string };
}

interface LdBusiness {
  offers?: LdOffer[];
  aggregateRating?: { ratingValue?: number; reviewCount?: number };
}

function walkForBusiness(node: unknown, depth: number): LdBusiness | null {
  if (depth > 6 || node == null || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const hit = walkForBusiness(item, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  const n = node as LdBusiness;
  if (Array.isArray(n.offers) && n.offers.length && n.offers.some((o) => o?.offeredBy)) return n;
  for (const value of Object.values(node)) {
    const hit = walkForBusiness(value, depth + 1);
    if (hit) return hit;
  }
  return null;
}

function findLdBusiness(): LdBusiness | null {
  for (const script of Array.from(document.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      const hit = walkForBusiness(JSON.parse(script.textContent ?? "null"), 0);
      if (hit) return hit;
    } catch { /* malformed block — skip */ }
  }
  return null;
}

/** Builds the complete bank → tier → card structure from the page's JSON-LD.
 * This covers ALL banks regardless of which filter is active in the DOM.
 * Offer description format: "40% off with <Bank> <Card name>". */
export function banksFromJsonLd(): { banks: TakhfifBankOffers[]; rating?: number; reviewCount?: number } | null {
  const ld = findLdBusiness();
  if (!ld?.offers?.length) return null;

  const byBank = new Map<string, TakhfifBankOffers>();
  for (const offer of ld.offers) {
    const bankName = offer.offeredBy?.name?.trim();
    const pct = typeof offer.discount === "number" ? offer.discount : null;
    if (!bankName || !offer.description) continue;
    const cardName = offer.description
      .replace(new RegExp(`^\\s*\\d+%\\s*off\\s*with\\s*${bankName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"), "")
      .replace(/\s+/g, " ").trim();
    if (!cardName) continue;

    let bank = byBank.get(bankName);
    if (!bank) {
      bank = { bankName, maxDiscountPercentage: null, terms: [], tiers: [] };
      byBank.set(bankName, bank);
    }
    if (pct != null && (bank.maxDiscountPercentage == null || pct > bank.maxDiscountPercentage)) {
      bank.maxDiscountPercentage = pct;
    }
    let tier: TakhfifOfferTier | undefined = bank.tiers.find((t) => t.discountPercentage === pct);
    if (!tier) {
      tier = { discountPercentage: pct, title: pct != null ? `${pct}% off` : "Offer", cards: [] };
      bank.tiers.push(tier);
    }
    if (!tier.cards.some((c) => c.cardName.toLowerCase() === cardName.toLowerCase())) {
      tier.cards.push({
        cardName,
        discountPercentage: pct,
        currency: offer.priceCurrency,
        validThrough: offer.validThrough,
      });
    }
  }
  if (!byBank.size) return null;
  for (const bank of byBank.values()) {
    bank.tiers.sort((a, b) => (b.discountPercentage ?? 0) - (a.discountPercentage ?? 0));
  }
  return {
    banks: Array.from(byBank.values()),
    rating: ld.aggregateRating?.ratingValue,
    reviewCount: ld.aggregateRating?.reviewCount,
  };
}

/** Enriches the authoritative JSON-LD structure with what only the DOM has:
 * per-card max-discount amounts, tier titles, terms, validity text and the
 * bank's offer-page URL — matched by bank name, then card name. */
export function enrichBanks(ldBanks: TakhfifBankOffers[], domBanks: TakhfifBankOffers[], detail: TakhfifBusinessDetail): void {
  const key = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  for (const bank of ldBanks) {
    const dom = domBanks.find((d) => key(d.bankName) === key(bank.bankName));
    if (!dom) {
      detail.warnings.push(`No DOM enrichment for "${bank.bankName}" (terms/max amounts may be missing).`);
      continue;
    }
    bank.terms = dom.terms;
    bank.bankOfferUrl = dom.bankOfferUrl;
    bank.validityText = dom.validityText;
    bank.cardsAvailableText = dom.cardsAvailableText;
    const domCards = new Map(dom.tiers.flatMap((t) => t.cards.map((c) => [key(c.cardName), c] as const)));
    for (const tier of bank.tiers) {
      const domTier = dom.tiers.find((t) => t.discountPercentage === tier.discountPercentage);
      if (domTier) { tier.title = domTier.title; tier.cardsCountText = domTier.cardsCountText; }
      for (const card of tier.cards) {
        const dc = domCards.get(key(card.cardName));
        if (dc) {
          card.maxDiscountText = dc.maxDiscountText;
          card.maxDiscountAmount = dc.maxDiscountAmount;
          card.currency = card.currency ?? dc.currency;
        }
      }
    }
  }
}
