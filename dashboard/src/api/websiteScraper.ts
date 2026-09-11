import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export type ScrapeStatus =
  | "NEW" | "UNCHANGED" | "UPDATED" | "SALE_DETECTED" | "NOT_SALE" | "DUPLICATE" | "ERROR" | "BLOCKED";
export type ClosureStatus = "ACTIVE" | "POSSIBLY_ENDED" | "EXPIRED" | "MANUALLY_CLOSED";

export interface WebsiteAiResult {
  is_offer: boolean;
  title: string | null;
  description: string | null;
  discount_percentage: number | null;
  coupon_code: string | null;
  offer_type: string | null;
  start_date: string | null;
  end_date: string | null;
  applicable_scope: string | null;
  confidence: number;
  reasoning: string;
}

export interface WebsiteScrapedPage {
  id: number;
  brand_id: number | null;
  url: string;
  final_url: string | null;
  page_type: string | null;
  page_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  headline_text: string | null;
  body_text: string | null;
  important_text: string[];
  images: string[];
  image_alt_text: string[];
  detected_prices: { original: number | null; current: number | null }[];
  discount_percentages: number[];
  coupon_codes: string[];
  links: string[];
  page_content_hash: string | null;
  normalized_content_hash: string | null;
  sale_score: number | null;
  scrape_status: ScrapeStatus;
  ai_analyzed: boolean;
  ai_result: WebsiteAiResult | null;
  offer_id: number | null;
  http_status: number | null;
  error_message: string | null;
  scraped_at: string | null;
  processing_duration: number | null;
  created_at: string | null;
}

export interface WebsiteScrapeHistory {
  brand_id: number;
  first_scraped_at: string | null;
  last_scraped_at: string | null;
  last_successful_scrape_at: string | null;
  last_content_change_at: string | null;
  last_detected_sale_at: string | null;
  total_scrape_count: number;
  pages_discovered: number;
  status: "success" | "failed" | "never_run";
  error_message: string | null;
}

export interface WebsiteBrandSummary {
  brand_id: number;
  brand_name: string;
  website: string;
  scraping_enabled: boolean;
  last_scraped_at: string | null;
  last_successful_scrape_at: string | null;
  last_content_change_at: string | null;
  pages_discovered: number;
  active_offers: number;
  total_offers: number;
  status: "success" | "failed" | "never_run";
  last_error: string | null;
}

export interface WebsiteOffer {
  id: number;
  title: string | null;
  brand: string | null;
  discount_percentage: number | null;
  coupon_code: string | null;
  offer_type: string | null;
  summary: string | null;
  website: string | null;
  source: string;
  source_url: string | null;
  closure_status: ClosureStatus | null;
  missing_count: number;
  is_active: boolean;
  expiry_date: string | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  last_verified_at: string | null;
  created_at: string | null;
}

export interface BrandScrapeConfig {
  brand_id: number;
  homepage_url: string | null;
  sale_page_url: string | null;
  offers_page_url: string | null;
  promotions_page_url: string | null;
  custom_scrape_urls: string[];
  website_scraping_enabled: boolean;
}

export function isHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function useBrandScrapeConfig(brandId: number | null) {
  return useQuery({
    queryKey: ["website-scraper", "config", brandId],
    queryFn: async () => {
      const { data } = await apiClient.get<BrandScrapeConfig>(`/website-scraper/brands/${brandId}/config`);
      return data;
    },
    enabled: brandId != null,
  });
}

export function useWebsiteBrandsSummary() {
  return useQuery({
    queryKey: ["website-scraper", "brands"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ brands: WebsiteBrandSummary[] }>("/website-scraper/brands");
      return data.brands;
    },
  });
}

export function useWebsitePages(brandId: number | null) {
  return useQuery({
    queryKey: ["website-scraper", "pages", brandId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ pages: WebsiteScrapedPage[] }>(`/website-scraper/brands/${brandId}/pages`);
      return data.pages;
    },
    enabled: brandId != null,
  });
}

export function useWebsiteJobPages(jobId: number | null) {
  return useQuery({
    queryKey: ["website-scraper", "job-pages", jobId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ pages: WebsiteScrapedPage[] }>(`/website-scraper/jobs/${jobId}/pages`);
      return data.pages;
    },
    enabled: jobId != null,
  });
}

export function useWebsitePage(pageId: number | null) {
  return useQuery({
    queryKey: ["website-scraper", "page", pageId],
    queryFn: async () => {
      const { data } = await apiClient.get<WebsiteScrapedPage>(`/website-scraper/pages/${pageId}`);
      return data;
    },
    enabled: pageId != null,
  });
}

export function useWebsiteHistory(brandId: number | null) {
  return useQuery({
    queryKey: ["website-scraper", "history", brandId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ history: WebsiteScrapeHistory | null }>(`/website-scraper/brands/${brandId}/history`);
      return data.history;
    },
    enabled: brandId != null,
  });
}

export function useWebsiteBrandOffers(brandId: number | null) {
  return useQuery({
    queryKey: ["website-scraper", "offers", brandId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ offers: WebsiteOffer[] }>(`/website-scraper/brands/${brandId}/offers`);
      return data.offers;
    },
    enabled: brandId != null,
  });
}

export interface WebsiteActivityEntry {
  id: number;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  time: string;
}

export function useWebsiteActivity() {
  return useQuery({
    queryKey: ["website-scraper", "activity"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ activity: WebsiteActivityEntry[] }>("/website-scraper/activity");
      return data.activity;
    },
    refetchInterval: 15000,
  });
}

export function useScrapeNow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { brand_id?: number; url?: string }) => {
      const { data } = await apiClient.post<{ jobId: number }>("/website-scraper/scrape-now", body);
      return data;
    },
    onSuccess: () => {
      toast.success("Scraping started.");
      queryClient.invalidateQueries({ queryKey: ["website-scraper"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useReprocessPage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pageId: number) => {
      const { data } = await apiClient.post<{ jobId: number }>(`/website-scraper/pages/${pageId}/reprocess`);
      return data;
    },
    onSuccess: () => {
      toast.success("Reprocessing started.");
      queryClient.invalidateQueries({ queryKey: ["website-scraper"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });
}

export function useReanalyzePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pageId: number) => {
      const { data } = await apiClient.post<WebsiteScrapedPage>(`/website-scraper/pages/${pageId}/reanalyze`);
      return data;
    },
    onSuccess: (_data, pageId) => {
      toast.success("Re-analyzed.");
      queryClient.invalidateQueries({ queryKey: ["website-scraper", "page", pageId] });
      queryClient.invalidateQueries({ queryKey: ["website-scraper", "pages"] });
    },
  });
}

export function useUpdateBrandScrapeConfig(brandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Omit<BrandScrapeConfig, "brand_id">>) => {
      const { data } = await apiClient.post<BrandScrapeConfig>(`/website-scraper/brands/${brandId}/config`, body);
      return data;
    },
    onSuccess: () => {
      toast.success("Website scraper config saved.");
      queryClient.invalidateQueries({ queryKey: ["website-scraper", "brands"] });
      queryClient.invalidateQueries({ queryKey: ["website-scraper", "config", brandId] });
    },
  });
}

export function useCloseOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (offerId: number) => {
      const { data } = await apiClient.patch<WebsiteOffer>(`/website-scraper/offers/${offerId}/close`);
      return data;
    },
    onSuccess: () => {
      toast.success("Offer closed.");
      queryClient.invalidateQueries({ queryKey: ["website-scraper", "offers"] });
    },
  });
}
