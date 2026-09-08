import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export type SocialPlatform = "facebook" | "instagram";
export type PostStatus = "pending" | "processing" | "processed" | "failed";
export type KeywordStatus = "eligible_for_analysis" | "needs_review" | "not_sale_related";

export interface SocialAiResult {
  is_offer: boolean;
  title: string | null;
  description: string | null;
  discount_percentage: number | null;
  coupon_code: string | null;
  offer_type: string | null;
  category: string | null;
  subcategory: string | null;
  expiry_date: string | null;
  confidence: number;
  reasoning: string;
}

export interface SocialPost {
  id: number;
  brand_id: number | null;
  platform: SocialPlatform;
  post_url: string;
  caption: string | null;
  image_url: string | null;
  post_date: string | null;
  ocr_text: string | null;
  keyword_score: number | null;
  keyword_status: KeywordStatus | null;
  keyword_reason: string | null;
  ai_result: SocialAiResult | null;
  offer_id: number | null;
  offer?: { id: number; title: string | null; brand: string | null; discount_percentage: number | null } | null;
  status: PostStatus;
  error: string | null;
  job_id: number | null;
  scraped_at: string | null;
  created_at: string | null;
}

export interface PreviewResult {
  caption: string | null;
  image_url: string | null;
  source: string | null;
}

export interface ScrapeHistoryEntry {
  id: number;
  brand_id: number;
  platform: SocialPlatform;
  last_scraped_at: string | null;
  last_post_url: string | null;
  status: "success" | "failed" | "never_run";
  error_message: string | null;
  posts_checked: number;
  offers_created: number;
  updated_at: string | null;
}

export function useFetchPreview() {
  return useMutation({
    mutationFn: async (body: { platform: SocialPlatform; post_url: string }) => {
      const { data } = await apiClient.post<PreviewResult>("/social-scraper/fetch-preview", body);
      return data;
    },
  });
}

export function useSubmitPost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      platform: SocialPlatform;
      post_url: string;
      caption?: string;
      image_url?: string;
      post_date?: string;
      brand_id?: number;
    }) => {
      const { data } = await apiClient.post<{ postId: number; jobId: number }>("/social-scraper/submit", body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-scraper"] });
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Could not submit this post.";
      toast.error(message);
    },
  });
}

export function usePost(id: number | null) {
  return useQuery({
    queryKey: ["social-scraper", "post", id],
    queryFn: async () => {
      const { data } = await apiClient.get<SocialPost>(`/social-scraper/posts/${id}`);
      return data;
    },
    enabled: id != null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "processing" ? 1500 : false;
    },
  });
}

export function usePosts(brandId?: number) {
  return useQuery({
    queryKey: ["social-scraper", "posts", brandId ?? null],
    queryFn: async () => {
      const { data } = await apiClient.get<{ posts: SocialPost[] }>("/social-scraper/posts", {
        params: brandId ? { brand_id: brandId } : undefined,
      });
      return data.posts;
    },
  });
}

export function useSaveOffer(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ offer_id: number; brand: string | null; already_existed: boolean }>(
        `/social-scraper/posts/${id}/save-offer`,
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["social-scraper", "post", id] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast.success(data.already_existed ? "Offer already saved." : "Offer saved.");
    },
  });
}

export function useScrapeHistory(brandId: number | null) {
  return useQuery({
    queryKey: ["social-scraper", "history", brandId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ history: ScrapeHistoryEntry[] }>("/social-scraper/scrape-history", {
        params: { brand_id: brandId },
      });
      return data.history;
    },
    enabled: brandId != null,
  });
}
