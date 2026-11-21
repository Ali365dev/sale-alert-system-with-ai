import { useMutation } from "@tanstack/react-query";

import { apiClient } from "./client";

import type { BrandRequest } from "./brandRequests";

/** Public — the website's "Request a Brand" form (the app's RequestBrandScreen
 * equivalent). POST /api/brand-requests lives on app_server with no auth;
 * the admin review queue in brandRequests.ts is on scraper_server. */
export function useCreateBrandRequest() {
  return useMutation({
    mutationFn: async (input: { brand_name: string; category?: string | null; note?: string | null }) => {
      const { data } = await apiClient.post<BrandRequest>("/brand-requests", input);
      return data;
    },
  });
}
