import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export interface FetchEmailsLogEntry {
  time: string;
  message: string;
}

export interface FetchEmailsStatus {
  running: boolean;
  phase: "idle" | "listing" | "fetching" | "done" | "cancelled" | "error";
  done: number;
  total: number;
  fetched: number;
  error: string | null;
  logs: FetchEmailsLogEntry[];
}

export function useFetchEmails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ status: string }>("/actions/fetch-emails");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      toast.info("Fetching emails from Gmail…");
    },
  });
}

export function useCancelFetchEmails() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ status: string }>("/actions/fetch-emails/cancel");
      return data;
    },
    onSuccess: () => toast.info("Cancelling fetch…"),
  });
}

export function useFetchEmailsStatus() {
  return useQuery({
    queryKey: ["actions", "fetch-emails-status"],
    queryFn: async () => {
      const { data } = await apiClient.get<FetchEmailsStatus>("/actions/fetch-emails/status");
      return data;
    },
    // Always poll on mount so a page reload re-attaches to whatever the
    // server is actually doing, instead of trusting client-only mutation state.
    refetchInterval: (query) => (query.state.data?.running ? 1500 : false),
  });
}

export interface ProcessPendingStatus {
  running: boolean;
  processed: number;
  failed: number;
  error: string | null;
}

export function useProcessPending() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ status: string }>("/actions/process-pending");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      toast.info("Processing pending emails into offers…");
    },
  });
}

export function useProcessPendingStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["actions", "process-pending-status"],
    queryFn: async () => {
      const { data } = await apiClient.get<ProcessPendingStatus>("/actions/process-pending/status");
      return data;
    },
    enabled,
    refetchInterval: enabled ? 1500 : false,
  });
}

export interface FetchSalesWebStatus {
  running: boolean;
  saved: number;
  failed: number;
  total_active: number;
  done: number;
  total: number;
}

export function useFetchSalesWeb() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ status: string }>("/actions/fetch-sales-web");
      return data;
    },
    onSuccess: () => toast.info("Searching the web for sales — this may take a while."),
  });
}

export function useFetchSalesWebStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["actions", "fetch-sales-web-status"],
    queryFn: async () => {
      const { data } = await apiClient.get<FetchSalesWebStatus>("/actions/fetch-sales-web/status");
      return data;
    },
    enabled,
    refetchInterval: enabled ? 1500 : false,
  });
}

export interface ResearchBrandsStatus {
  running: boolean;
  done: number;
  total: number;
  inserted: number;
  updated: number;
  failed_brands: string[];
}

export function useResearchBrands() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ status: string }>("/actions/research-brands");
      return data;
    },
    onSuccess: () => toast.info("Researching brands via Tavily + Llama — this may take a while."),
  });
}

export function useResearchBrandsStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["actions", "research-brands-status"],
    queryFn: async () => {
      const { data } = await apiClient.get<ResearchBrandsStatus>("/actions/research-brands/status");
      return data;
    },
    enabled,
    refetchInterval: enabled ? 1500 : false,
  });
}
