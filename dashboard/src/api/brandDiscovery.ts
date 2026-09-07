import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export type DiscoveryStatus = "pending" | "discovering" | "review" | "saved" | "discarded" | "failed";
export type DiscoveryMode = "search_name" | "scan_website";

export const SOCIAL_PLATFORMS = ["facebook", "instagram", "tiktok", "twitter", "youtube", "linkedin"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export interface SearchCandidate {
  name: string;
  website: string;
  domain: string;
  logo_url: string | null;
  description: string | null;
  category: string;
  source: "search_result";
}

export interface SocialLinkEntry {
  url: string;
  source: string;
  verified: boolean;
}

export type FieldSources = Partial<
  Record<"name" | "website" | "logo_url" | "description" | "category" | "subcategory" | "country", string | null>
>;

export interface BrandDiscovery {
  id: number;
  mode: DiscoveryMode;
  query: string;
  status: DiscoveryStatus;
  job_id: number | null;
  brand_request_id: number | null;
  name: string | null;
  website: string | null;
  logo_url: string | null;
  description: string | null;
  category: string | null;
  subcategory: string | null;
  country: string | null;
  field_sources: FieldSources;
  social_links: Partial<Record<SocialPlatform, SocialLinkEntry>>;
  confidence: number | null;
  duplicate_brand_id: number | null;
  duplicate_score: number | null;
  duplicate_reason: string | null;
  duplicate_brand?: { id: number; name: string; website: string | null } | null;
  error: string | null;
  resolved_brand_id: number | null;
  resolved_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useSearchCandidates() {
  return useMutation({
    mutationFn: async (brand_name: string) => {
      const { data } = await apiClient.post<{ candidates: SearchCandidate[] }>("/brand-discovery/search-candidates", {
        brand_name,
      });
      return data.candidates;
    },
  });
}

export function useStartDiscovery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { mode: DiscoveryMode; website: string; seed_name?: string; brand_request_id?: number }) => {
      const { data } = await apiClient.post<{ discoveryId: number; jobId: number }>("/brand-discovery/start", body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-discovery"] });
    },
    onError: () => {
      toast.error("Could not start brand discovery.");
    },
  });
}

export function useBrandDiscoveries() {
  return useQuery({
    queryKey: ["brand-discovery", "list"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ discoveries: BrandDiscovery[] }>("/brand-discovery");
      return data.discoveries;
    },
  });
}

export function useBrandDiscovery(id: number | null) {
  return useQuery({
    queryKey: ["brand-discovery", id],
    queryFn: async () => {
      const { data } = await apiClient.get<BrandDiscovery>(`/brand-discovery/${id}`);
      return data;
    },
    enabled: id != null,
    // Polls while the job is still crawling/extracting so the review screen
    // appears the moment status flips to "review" — off once it settles.
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "pending" || status === "discovering" ? 1500 : false;
    },
  });
}

export function useUpdateBrandDiscovery(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Pick<BrandDiscovery, "name" | "website" | "logo_url" | "description" | "category" | "subcategory" | "country">> & {
      social_links?: Partial<Record<SocialPlatform, { url: string; verified?: boolean }>>;
    }) => {
      const { data } = await apiClient.put<BrandDiscovery>(`/brand-discovery/${id}`, body);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["brand-discovery", id], data);
    },
  });
}

export function useSaveBrandDiscovery(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { action: "create" | "merge"; target_brand_id?: number }) => {
      const { data } = await apiClient.post<{ brand_id: number; brand_name: string }>(`/brand-discovery/${id}/save`, body);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["brand-discovery"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      // A discovery started from a Brand Request's "Discover" button marks
      // that request "added" server-side (app/api/routers/brand_discovery.py's
      // save_discovery) — harmless no-op refetch when there was no such link.
      queryClient.invalidateQueries({ queryKey: ["brand-requests"] });
      toast.success(`Saved "${data.brand_name}" to Brands.`);
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Could not save this brand.";
      toast.error(message);
    },
  });
}

export function useDiscardBrandDiscovery(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete(`/brand-discovery/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["brand-discovery"] });
      toast.success("Discarded.");
    },
  });
}
