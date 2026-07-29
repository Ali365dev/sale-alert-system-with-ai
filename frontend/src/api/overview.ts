import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export interface CountItem {
  name: string;
  count: number;
}

export interface VerificationCount {
  status: string;
  count: number;
}

export interface LatestOffer {
  id: number;
  brand: string | null;
  category: string | null;
  subcategory: string | null;
  offer_type: string | null;
  discount_percentage: number | null;
  coupon_code: string | null;
  expiry_date: string | null;
  verification_status: string;
  summary: string | null;
}

export interface OverviewResponse {
  kpis: {
    total_offers: number;
    verified: number;
    invalid: number;
    expiring_soon: number;
  };
  top_brands: CountItem[];
  top_categories: CountItem[];
  top_subcategories: CountItem[];
  verification_status: VerificationCount[];
  latest_offers: LatestOffer[];
}

async function fetchOverview(): Promise<OverviewResponse> {
  const { data } = await apiClient.get<OverviewResponse>("/overview");
  return data;
}

export function useOverview() {
  return useQuery({
    queryKey: ["overview"],
    queryFn: fetchOverview,
  });
}

async function triggerRunFetch(): Promise<{ status: string }> {
  const { data } = await apiClient.post<{ status: string }>("/run-fetch");
  return data;
}

export function useRunFetch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerRunFetch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      toast.info("Fetch & analyse started — this may take a moment.");
    },
  });
}
