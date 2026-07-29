import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export interface Brand {
  id: number;
  name: string;
  website: string | null;
  categories: string[];
  emails: string[];
  is_active: boolean;
  last_searched: string | null;
  created_at: string | null;
}

export interface BrandsResponse {
  brands: Brand[];
  summary: {
    total: number;
    active: number;
    ever_searched: number;
    known_sender_emails: number;
  };
}

async function fetchBrands(): Promise<BrandsResponse> {
  const { data } = await apiClient.get<BrandsResponse>("/brands");
  return data;
}

export function useBrands() {
  return useQuery({ queryKey: ["brands"], queryFn: fetchBrands });
}

export type BrandInput = Partial<Omit<Brand, "id" | "created_at" | "last_searched">>;

export function useCreateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BrandInput) => {
      const { data } = await apiClient.post<Brand>("/brands", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Brand added.");
    },
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: BrandInput }) => {
      const { data } = await apiClient.put<Brand>(`/brands/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Brand updated.");
    },
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/brands/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Brand deleted.");
    },
  });
}

export interface BrandSearchResult {
  found: number;
  active: number;
  saved: number;
  failed: number;
  preview: { offer_type: string | null; discount_percentage: number | null; coupon_code: string | null; summary: string }[];
}

export function useSearchBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<BrandSearchResult>(`/brands/${id}/search`);
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success(`Found ${result.found} offer(s) — ${result.saved} saved.`);
    },
  });
}

export function useBulkSearchBrands() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (skipCache: boolean) => {
      const { data } = await apiClient.post<{ status: string }>("/brands/bulk-search", { skip_cache: skipCache });
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
      const { data } = await apiClient.get<BulkSearchStatus>("/brands/bulk-search/status");
      return data;
    },
    enabled,
    refetchInterval: enabled ? 1500 : false,
  });
}
