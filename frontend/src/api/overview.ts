import { useQuery } from "@tanstack/react-query";

import { apiClient } from "./client";

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
