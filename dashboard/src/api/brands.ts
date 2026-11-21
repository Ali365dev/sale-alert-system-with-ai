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
  logo_url: string | null;
  logo_scale: number;
  logo_offset_x: number;
  logo_offset_y: number;
  description: string | null;
  country: string | null;
  social_links: Record<string, string | null> | null;
  homepage_url: string | null;
  sale_page_url: string | null;
  offers_page_url: string | null;
  promotions_page_url: string | null;
  custom_scrape_urls: string[] | null;
  website_scraping_enabled: boolean;
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

async function fetchBrands(region: string | null): Promise<BrandsResponse> {
  const params = region ? { region } : {};
  const { data } = await apiClient.get<BrandsResponse>("/brands", { params });
  return data;
}

export function useBrands(region: string | null = null) {
  return useQuery({ queryKey: ["brands", region], queryFn: () => fetchBrands(region) });
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

export function useUpdateBrandLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: number;
      input: {
        logo_url?: string | null;
        logo_scale?: number;
        logo_offset_x?: number;
        logo_offset_y?: number;
        reset_logo_transform?: boolean;
      };
    }) => {
      const { data } = await apiClient.put<Brand>(`/brands/${id}/logo`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Logo settings saved.");
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
