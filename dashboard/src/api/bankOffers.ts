import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { scraperClient as apiClient } from "./client";
import { toast } from "../store/toastStore";

export interface ScrapedBusinessSummary {
  id: number;
  slug: string;
  name: string;
  category: string | null;
  city: string | null;
  rating: number | null;
  review_count: number | null;
  logo_url: string | null;
  source_url: string;
  brand_id: number | null;
  brand_name: string | null;
  offers_count: number;
  banks_count: number;
  is_active: boolean;
  last_scraped_at: string | null;
}

export interface BankOfferRow {
  id: number;
  bank_name: string;
  card_name: string | null;
  discount_percentage: number | null;
  max_discount_text: string | null;
  max_discount_amount: number | null;
  branch_valid_count: number | null;
  branch_total_count: number | null;
  valid_branches: string[];
  valid_days: string[];
  terms: string[];
  currency: string | null;
  expiry_date: string | null;
  place_name: string;
  source_url: string;
  brand_id: number | null;
  brand_name: string | null;
  business_id: number | null;
}

export interface ScrapedBusinessDetail extends ScrapedBusinessSummary {
  description: string | null;
  phone: string | null;
  website: string | null;
  cover_image_url: string | null;
  branches: Array<{ name: string; address: string; latitude?: number; longitude?: number; directionsUrl?: string }>;
  opening_hours: Array<{ day: string; hours: string }>;
  gallery: string[];
  social_links: Record<string, string>;
  menu_pages: number | null;
  offers: BankOfferRow[];
}

export interface CombinedOffers {
  brand: { id: number; name: string; logo_url: string | null; website: string | null };
  sale_offers: Array<{
    id: number; title: string | null; offer_type: string | null;
    discount_percentage: number | null; coupon_code: string | null;
    expiry_date: string | null; source: string | null; offer_value: string | null;
  }>;
  bank_offers: BankOfferRow[];
  businesses: Array<{ id: number; slug: string; name: string; city: string | null }>;
}

export interface BankOfferListResponse {
  total: number;
  matched_count: number;
  with_expiry_count: number;
  with_max_disc_count: number;
  offers: BankOfferRow[];
  bank_names: string[];
}

export function useListBankOffers(params: {
  q?: string;
  brand_id?: number;
  bank_name?: string;
  matched_only?: boolean;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["bank-offers-list", params],
    queryFn: async () => {
      const { data } = await apiClient.get<BankOfferListResponse>("/bank-offers", { params });
      return data;
    },
  });
}

export function useScrapeBankOffers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (maxPages?: number) => {
      const { data } = await apiClient.post<{ jobId: number }>("/bank-offers/scrape", maxPages ? { max_pages: maxPages } : {});
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-offers-list"] });
      queryClient.invalidateQueries({ queryKey: ["bank-offer-businesses"] });
      toast.success("Scrape job started.");
    },
  });
}

export function useScrapedBusinesses(params: { q?: string; matched_only?: boolean; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["bank-offer-businesses", params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ total: number; businesses: ScrapedBusinessSummary[] }>(
        "/bank-offers/businesses", { params });
      return data;
    },
  });
}

export function useScrapedBusiness(id: number | null) {
  return useQuery({
    queryKey: ["bank-offer-business", id],
    enabled: id != null,
    queryFn: async () => {
      const { data } = await apiClient.get<ScrapedBusinessDetail>(`/bank-offers/businesses/${id}`);
      return data;
    },
  });
}

export function useSetBusinessBrand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, brand_id }: { id: number; brand_id: number | null }) => {
      const { data } = await apiClient.patch(`/bank-offers/businesses/${id}/brand`, { brand_id });
      return data as { business_id: number; brand_id: number | null; brand_name: string | null };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["bank-offer-businesses"] });
      queryClient.invalidateQueries({ queryKey: ["bank-offer-business"] });
      toast.success(data.brand_name ? `Linked to ${data.brand_name}.` : "Brand link cleared.");
    },
  });
}

export function useDeleteScrapedBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/bank-offers/businesses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bank-offer-businesses"] });
      toast.success("Business deleted.");
    },
  });
}

export function useCombinedOffers(brandId: number | null) {
  return useQuery({
    queryKey: ["combined-offers", brandId],
    enabled: brandId != null,
    queryFn: async () => {
      const { data } = await apiClient.get<CombinedOffers>(`/bank-offers/combined/${brandId}`);
      return data;
    },
  });
}
