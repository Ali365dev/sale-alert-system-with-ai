import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export type UnknownEmailStatus = "pending" | "analyzed" | "resolved" | "ignored";

export interface UnknownEmailSuggestion {
  name: string | null;
  website: string | null;
  category: string | null;
  logo_url: string | null;
  country: string | null;
  socials: Record<string, string | null>;
  confidence: number | null;
  reasoning: string | null;
}

export interface UnknownEmailDuplicate {
  brand_id: number;
  score: number | null;
  reason: string | null;
}

export interface UnknownEmail {
  id: number;
  email_id: number;
  status: UnknownEmailStatus;
  sender: string;
  sender_domain: string | null;
  subject: string;
  received_date: string | null;
  suggestion: UnknownEmailSuggestion | null;
  duplicate: UnknownEmailDuplicate | null;
  analysis_error: string | null;
  analyzed_at: string | null;
  resolved_brand_id: number | null;
  resolved_at: string | null;
  created_at: string | null;
}

export interface UnknownEmailDetail extends UnknownEmail {
  body: string | null;
  ocr_text_clean: string | null;
  image_urls: string[];
}

export interface UnknownEmailsSummary {
  total: number;
  pending: number;
  analyzed: number;
  resolved: number;
  ignored: number;
}

export interface UnknownEmailsResponse {
  candidates: UnknownEmail[];
  total: number;
  page: number;
  page_size: number;
  summary: UnknownEmailsSummary;
}

export type UnknownEmailSortField = "created_at" | "confidence" | "status" | "id";

export interface UnknownEmailsParams {
  status?: UnknownEmailStatus;
  q?: string;
  page?: number;
  page_size?: number;
  sort?: UnknownEmailSortField;
  sort_dir?: "asc" | "desc";
}

/** Parses "Brand Name <offers@brand.com>" -> { name, email }. Falls back to
 * treating the whole string as the address when there's no display name. */
export function parseSender(sender: string): { name: string; email: string } {
  const match = sender.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (match) {
    return { name: match[1].trim() || match[2], email: match[2].trim() };
  }
  return { name: sender, email: sender };
}

export function useUnknownEmails(params: UnknownEmailsParams) {
  return useQuery({
    queryKey: ["unknown-emails", params],
    queryFn: async () => {
      const { data } = await apiClient.get<UnknownEmailsResponse>("/unknown-emails", { params });
      return data;
    },
  });
}

export function useUnknownEmail(id: number | null) {
  return useQuery({
    queryKey: ["unknown-emails", id],
    queryFn: async () => {
      const { data } = await apiClient.get<UnknownEmailDetail>(`/unknown-emails/${id}`);
      return data;
    },
    enabled: id !== null,
  });
}

export function useIgnoreUnknownEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<UnknownEmail>(`/unknown-emails/${id}/ignore`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unknown-emails"] });
      toast.success("Marked as ignored.");
    },
  });
}

export function useDeleteUnknownEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/unknown-emails/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unknown-emails"] });
      toast.success("Deleted.");
    },
  });
}

export function useBulkUnknownEmailAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ action, ids }: { action: "ignore" | "delete"; ids: number[] }) => {
      const { data } = await apiClient.post<{ status: string; count: number }>("/unknown-emails/bulk", { action, ids });
      return data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["unknown-emails"] });
      toast.success(
        variables.action === "delete" ? `Deleted ${data.count} email(s).` : `Ignored ${data.count} email(s).`,
      );
    },
  });
}

export interface AddBrandFromCandidateInput {
  link_existing_brand_id?: number;
  name?: string;
  website?: string | null;
  category?: string | null;
  logo_url?: string | null;
  description?: string | null;
  country?: string | null;
  social_links?: Record<string, string | null>;
  is_active?: boolean;
}

export interface AddBrandFromCandidateResult {
  brand: { id: number; name: string };
  candidate: UnknownEmail;
  reprocessed: boolean;
  reprocess_result: { processing_status: string; processing_error: string | null };
}

export function useAddBrandFromCandidate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: AddBrandFromCandidateInput }) => {
      const { data } = await apiClient.post<AddBrandFromCandidateResult>(`/unknown-emails/${id}/add-brand`, input);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["unknown-emails"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      if (data.reprocessed) {
        toast.success(`Brand "${data.brand.name}" created — email reprocessed and offer extracted.`);
      } else {
        toast.info(
          `Brand "${data.brand.name}" created, but reprocessing failed: ${data.reprocess_result.processing_error ?? "unknown error"}`,
        );
      }
    },
  });
}
