import { useQuery } from "@tanstack/react-query";

import { apiClient } from "./client";

export interface InsightOffer {
  id: number;
  brand: string | null;
  category: string | null;
  discount_percentage: number | null;
  coupon_code: string | null;
  expiry_date: string | null;
  verification_status: string;
  summary: string | null;
  key_highlights: string[];
}

export interface RecommendedAction {
  id: string;
  title: string;
  detail: string;
  done: boolean;
}

export interface HighlightItem {
  brand: string | null;
  text: string;
}

export interface InsightsResponse {
  digest: string | null;
  stats: {
    emails_read: number;
    new_offers: number;
    avg_discount: number;
    flagged: number;
  };
  best_offers: InsightOffer[];
  expiring_soon: InsightOffer[];
  recommended_actions: RecommendedAction[];
  highlights: HighlightItem[];
}

async function fetchInsights(): Promise<InsightsResponse> {
  const { data } = await apiClient.get<InsightsResponse>("/insights");
  return data;
}

export function useInsights() {
  return useQuery({
    queryKey: ["insights"],
    queryFn: fetchInsights,
    staleTime: 5 * 60 * 1000,
  });
}
