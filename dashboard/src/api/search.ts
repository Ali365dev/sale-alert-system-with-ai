import { useQuery } from "@tanstack/react-query";

import { apiClient } from "./client";

export interface SearchFilters {
  brand?: string;
  subject?: string;
  category?: string;
  subcategory?: string;
  offer_type?: string;
  verification_status?: string;
  min_discount?: number;
  date_from?: string;
  date_to?: string;
}

export interface SearchResultRow {
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
  subject: string | null;
  sender: string | null;
  received_date: string | null;
}

export interface SearchResponse {
  count: number;
  results: SearchResultRow[];
}

function toParams(filters: SearchFilters): Record<string, string> {
  const params: Record<string, string> = {};
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== null) {
      params[key] = String(value);
    }
  });
  return params;
}

async function fetchSearch(filters: SearchFilters): Promise<SearchResponse> {
  const { data } = await apiClient.get<SearchResponse>("/search", { params: toParams(filters) });
  return data;
}

export function useSearch(filters: SearchFilters) {
  return useQuery({
    queryKey: ["search", filters],
    queryFn: () => fetchSearch(filters),
  });
}

export function exportSearchCsvUrl(filters: SearchFilters): string {
  const params = new URLSearchParams(toParams(filters));
  const base = apiClient.defaults.baseURL ?? "";
  return `${base}/search/export.csv?${params.toString()}`;
}
