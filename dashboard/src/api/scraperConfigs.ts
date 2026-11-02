import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scraperClient } from "./client";

export interface ScraperSelector {
  id: number;
  config_id: number;
  parent_id: number | null;
  name: string;
  selector_type: string;
  css_selector: string;
  attribute: string | null;
  multiple: boolean;
  enabled: boolean;
  sort_order: number;
  extraction_delay: number | null;
  created_at: string;
  updated_at: string;
}

export interface ScraperConfig {
  id: number;
  brand_id: number | null;
  name: string;
  description: string | null;
  start_urls: string[];
  max_pages: number;
  max_depth: number;
  max_links_per_page: number;
  request_delay: number;
  request_timeout: number;
  max_retries: number;
  enabled: boolean;
  selectors?: ScraperSelector[];
  created_at: string;
  updated_at: string;
}

export type ScraperConfigInput = Partial<Omit<ScraperConfig, "id" | "created_at" | "updated_at">>;
export type ScraperSelectorInput = Partial<Omit<ScraperSelector, "id" | "config_id" | "created_at" | "updated_at">>;

// ── Configs ──────────────────────────────────────────────────────────────────

export function useScraperConfigs(brandId?: number) {
  return useQuery({
    queryKey: ["scraper-configs", brandId],
    queryFn: async () => {
      const params = brandId ? { brand_id: brandId } : {};
      const res = await scraperClient.get("/scraper-configs", { params });
      return res.data as { configs: ScraperConfig[] };
    },
  });
}

export function useScraperConfig(configId: number | null) {
  return useQuery({
    queryKey: ["scraper-config", configId],
    queryFn: async () => {
      const res = await scraperClient.get(`/scraper-configs/${configId}`);
      return res.data as ScraperConfig;
    },
    enabled: configId !== null,
  });
}

export function useCreateScraperConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ScraperConfigInput) => scraperClient.post("/scraper-configs", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scraper-configs"] }),
  });
}

export function useUpdateScraperConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ScraperConfigInput }) =>
      scraperClient.put(`/scraper-configs/${id}`, input),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ["scraper-configs"] });
      qc.invalidateQueries({ queryKey: ["scraper-config", id] });
    },
  });
}

export function useDeleteScraperConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scraperClient.delete(`/scraper-configs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["scraper-configs"] }),
  });
}

export function useRunScraperConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scraperClient.post(`/scraper-configs/${id}/run`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

// ── Selectors ────────────────────────────────────────────────────────────────

export function useScraperSelectors(configId: number | null) {
  return useQuery({
    queryKey: ["scraper-selectors", configId],
    queryFn: async () => {
      const res = await scraperClient.get(`/scraper-configs/${configId}/selectors`);
      return res.data as { selectors: ScraperSelector[] };
    },
    enabled: configId !== null,
  });
}

export function useCreateSelector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, input }: { configId: number; input: ScraperSelectorInput }) =>
      scraperClient.post(`/scraper-configs/${configId}/selectors`, input),
    onSuccess: (_data, { configId }) => {
      qc.invalidateQueries({ queryKey: ["scraper-selectors", configId] });
      qc.invalidateQueries({ queryKey: ["scraper-config", configId] });
    },
  });
}

export function useUpdateSelector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, selectorId, input }: { configId: number; selectorId: number; input: ScraperSelectorInput }) =>
      scraperClient.put(`/scraper-configs/${configId}/selectors/${selectorId}`, input),
    onSuccess: (_data, { configId }) => {
      qc.invalidateQueries({ queryKey: ["scraper-selectors", configId] });
      qc.invalidateQueries({ queryKey: ["scraper-config", configId] });
    },
  });
}

export function useDeleteSelector() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ configId, selectorId }: { configId: number; selectorId: number }) =>
      scraperClient.delete(`/scraper-configs/${configId}/selectors/${selectorId}`),
    onSuccess: (_data, { configId }) => {
      qc.invalidateQueries({ queryKey: ["scraper-selectors", configId] });
      qc.invalidateQueries({ queryKey: ["scraper-config", configId] });
    },
  });
}
