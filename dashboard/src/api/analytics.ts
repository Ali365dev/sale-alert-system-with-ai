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

export interface WebsiteScraperStats {
  brands_monitored: number;
  pages_scraped: number;
  sales_detected: number;
  active_offers: number;
  success_rate: number | null;
  last_scraped_at: string | null;
}

export interface SocialScraperStats {
  brands_tracked: number;
  posts_collected: number;
  posts_checked: number;
  offers_created: number;
  active_offers: number;
  success_rate: number | null;
  last_scraped_at: string | null;
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
  offers_by_source: CountItem[];
  website_scraper_stats: WebsiteScraperStats;
  social_scraper_stats: SocialScraperStats;
}

async function fetchAnalytics(): Promise<AnalyticsResponse> {
  const { data } = await apiClient.get<AnalyticsResponse>("/analytics");
  return data;
}

export function useAnalytics() {
  return useQuery({ queryKey: ["analytics"], queryFn: fetchAnalytics });
}
