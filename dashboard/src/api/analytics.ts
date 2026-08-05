import { useQuery } from "@tanstack/react-query";

import { apiClient } from "./client";
import type { CountItem, VerificationCount } from "./overview";

export interface HistogramBucket {
  range: string;
  count: number;
}

export interface MonthlyPoint {
  month: string;
  count: number;
}

export interface BrandPerformance {
  brand: string;
  offers: number;
  avg_discount: number | null;
  verified: number;
}

export interface AnalyticsResponse {
  offers_by_brand: CountItem[];
  offers_by_category: CountItem[];
  top_subcategories: CountItem[];
  offer_types: CountItem[];
  discount_histogram: HistogramBucket[];
  verification_status: VerificationCount[];
  monthly_trend: MonthlyPoint[];
  top_discounted_brands: { name: string; avg_discount: number }[];
  brand_performance: BrandPerformance[];
}

async function fetchAnalytics(): Promise<AnalyticsResponse> {
  const { data } = await apiClient.get<AnalyticsResponse>("/analytics");
  return data;
}

export function useAnalytics() {
  return useQuery({ queryKey: ["analytics"], queryFn: fetchAnalytics });
}
