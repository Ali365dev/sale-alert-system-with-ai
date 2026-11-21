// The brand AI offer search runs on scraper_server (routers/brand_search.py).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { scraperClient } from "./client";
import { toast } from "../store/toastStore";

export interface BrandSearchResult {
  found: number;
  active: number;
  saved: number;
  failed: number;
  preview: { offer_type: string | null; discount_percentage: number | null; coupon_code: string | null; summary: string }[];
}

export function useSearchBrand() {
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await scraperClient.post<{ status: string }>(`/brands/${id}/search`);
      return data;
    },
  });
}

export interface SingleSearchStatus {
  running: boolean;
  error: string | null;
  result: BrandSearchResult | null;
}

// Poll while a single-brand search is running. The caller is responsible for
// reacting to `data` transitioning to `running: false` (invalidate the brands
// list, show a toast) — see BrandsManager.tsx — since useQuery (v5) has no
// onSuccess/onSettled callback.
export function useSearchBrandStatus(brandId: number | null) {
  return useQuery({
    queryKey: ["brands", "search-status", brandId],
    queryFn: async () => {
      const { data } = await scraperClient.get<SingleSearchStatus>(`/brands/${brandId}/search/status`);
      return data;
    },
    enabled: brandId !== null,
    refetchInterval: (query) => (query.state.data?.running ? 1000 : false),
  });
}

export function useBulkSearchBrands() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (skipCache: boolean) => {
      const { data } = await scraperClient.post<{ status: string }>("/brands/bulk-search", { skip_cache: skipCache });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.info("Bulk brand search started — this may take a few minutes.");
    },
  });
}

export interface BulkSearchStatus {
  running: boolean;
  done: number;
  total: number;
  offers_found: number;
  offers_saved: number;
}

export function useBulkSearchStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["brands", "bulk-search-status"],
    queryFn: async () => {
      const { data } = await scraperClient.get<BulkSearchStatus>("/brands/bulk-search/status");
      return data;
    },
    enabled,
    refetchInterval: enabled ? 1500 : false,
  });
}
