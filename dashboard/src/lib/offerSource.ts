/** Shared offer-source labeling — every offer surface (admin OffersManager,
 * public OfferCard/OfferDetailPage) should show the same badge for the same
 * `Offer.source` value, so a website-scraped or social-scraped offer is
 * never mistaken for an email/manual one and vice versa. */
export type OfferSource = "email" | "ai" | "social" | "website";

export const SOURCE_LABEL: Record<OfferSource, string> = {
  email: "Email",
  ai: "AI Search",
  social: "Social",
  website: "Website",
};

export const SOURCE_TONE: Record<OfferSource, "success" | "warning" | "danger" | "neutral" | "ai" | "brand"> = {
  email: "neutral",
  ai: "ai",
  social: "warning",
  website: "brand",
};

export function sourceLabel(source: string | null | undefined): string | null {
  if (!source) return null;
  return SOURCE_LABEL[source as OfferSource] ?? source;
}

export function sourceTone(source: string | null | undefined): "success" | "warning" | "danger" | "neutral" | "ai" | "brand" {
  if (!source) return "neutral";
  return SOURCE_TONE[source as OfferSource] ?? "neutral";
}
