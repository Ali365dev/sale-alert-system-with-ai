import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export interface Offer {
  id: number;
  email_id: number | null;
  brand: string | null;
  company: string | null;
  category: string | null;
  subcategory: string | null;
  offer_type: string | null;
  discount_percentage: number | null;
  coupon_code: string | null;
  expiry_date: string | null;
  offer_value: string | null;
  website: string | null;
  summary: string | null;
  key_highlights: string[];
  is_active: boolean;
  created_at: string | null;
  verification_status: string | null;
  verification_reason: string | null;
  verification_confidence: number | null;
  verified_at: string | null;
}

export interface OfferFilters {
  brand?: string;
  category?: string;
  subcategory?: string;
  offer_type?: string;
  verification_status?: string;
  active?: "true" | "false";
}

export interface OffersSummary {
  total: number;
  verified: number;
  suspicious: number;
  invalid: number;
  unverified: number;
  active: number;
}

export interface OffersResponse {
  offers: Offer[];
  summary: OffersSummary;
}

function toParams(filters: OfferFilters): Record<string, string> {
  const params: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params[key] = value;
  });
  return params;
}

async function fetchOffers(filters: OfferFilters): Promise<OffersResponse> {
  const { data } = await apiClient.get<OffersResponse>("/offers", { params: toParams(filters) });
  return data;
}

export function useOffers(filters: OfferFilters) {
  return useQuery({ queryKey: ["offers", filters], queryFn: () => fetchOffers(filters) });
}

export type OfferInput = Partial<Omit<Offer, "id" | "created_at" | "verified_at">>;

export function useCreateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: OfferInput) => {
      const { data } = await apiClient.post<Offer>("/offers", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast.success("Offer created.");
    },
  });
}

export function useUpdateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: OfferInput }) => {
      const { data } = await apiClient.put<Offer>(`/offers/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast.success("Offer updated.");
    },
  });
}

export function useDeleteOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/offers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast.success("Offer deleted.");
    },
  });
}

export interface VerifyResult {
  is_valid_offer: boolean;
  confidence: number;
  reason: string;
  status: "verified" | "suspicious" | "invalid";
}

export function useVerifyOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<VerifyResult>(`/offers/${id}/verify`);
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      toast.success(`Offer verified — ${result.status} (${result.confidence}% confidence).`);
    },
  });
}

// Bulk "verify all unverified offers" is now the "verify_offers" background
// job — see api/jobs.ts's useStartJob("verify_offers")/useActiveJob("verify_offers").
