import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export type ProcessingStatus = "unprocessed" | "processed" | "failed";

export interface EmailSummary {
  id: number;
  sender: string;
  subject: string;
  brand: string | null;
  gmail_message_id: string;
  gmail_link: string | null;
  received_date: string | null;
  processed_at: string | null;
  status: string | null;
  note: string | null;
  verified_at: string | null;
  processing_status: ProcessingStatus;
  processing_error: string | null;
  processing_attempted_at: string | null;
  offers_count: number;
  image_count: number;
}

export interface EmailDetail extends EmailSummary {
  body: string | null;
  image_urls: string[];
  ocr_text_raw: string | null;
  ocr_text_clean: string | null;
  ocr_processed_at: string | null;
}

export interface EmailsSummary {
  total: number;
  unverified: number;
  legitimate: number;
  suspicious: number;
  spam: number;
  processed: number;
  unprocessed: number;
  failed: number;
}

export interface EmailsResponse {
  emails: EmailSummary[];
  total: number;
  page: number;
  page_size: number;
  summary: EmailsSummary;
}

export type EmailSortField = "received_date" | "sender" | "subject" | "processing_status" | "id";

export interface EmailsQuery {
  status?: string;
  processing_status?: ProcessingStatus;
  q?: string;
  page?: number;
  page_size?: number;
  sort?: EmailSortField;
  sort_dir?: "asc" | "desc";
}

export function useEmails(query: EmailsQuery, opts?: { liveWhileJobActive?: boolean }) {
  return useQuery({
    queryKey: ["emails", query],
    queryFn: async () => {
      const { data } = await apiClient.get<EmailsResponse>("/emails", { params: query });
      return data;
    },
    // keep showing the previous page's rows while the next page loads,
    // instead of flashing a loading state on every page/filter/sort change
    placeholderData: (prev) => prev,
    refetchInterval: opts?.liveWhileJobActive ? 2000 : false,
  });
}

export function useEmail(id: number | null) {
  return useQuery({
    queryKey: ["emails", "detail", id],
    queryFn: async () => {
      const { data } = await apiClient.get<EmailDetail>(`/emails/${id}`);
      return data;
    },
    enabled: id !== null,
  });
}

export function useProcessEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<{ processing_status: ProcessingStatus; processing_error: string | null }>(
        `/emails/${id}/process`,
      );
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      queryClient.invalidateQueries({ queryKey: ["offers"] });
      if (result.processing_status === "processed") {
        toast.success("Email processed — offer extracted and saved.");
      } else {
        toast.error(`Processing failed${result.processing_error ? `: ${result.processing_error}` : "."}`);
      }
    },
  });
}

export function useDeleteEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/emails/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      toast.success("Email deleted.");
    },
  });
}

export interface EmailVerifyResult {
  status: "legitimate" | "suspicious" | "spam";
  confidence: number;
  reason: string;
}

export function useVerifyEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<EmailVerifyResult>(`/emails/${id}/verify`);
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      toast.success(`Email classified as ${result.status} (${result.confidence}% confidence).`);
    },
  });
}

export function useVerifyAllEmails() {
  const queryClient = useQueryClient();
  return useMutation({
    // No statuses (or omitted) re-verifies unverified emails only, same as
    // before — pass e.g. ["suspicious", "spam"] to re-verify already-flagged
    // ones instead.
    mutationFn: async (statuses?: string[]) => {
      const { data } = await apiClient.post<{ status: string }>("/emails/verify-all", statuses?.length ? { statuses } : {});
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      toast.info("Bulk email verification started — this may take a moment.");
    },
  });
}

export interface VerifyAllEmailsStatus {
  running: boolean;
  done: number;
  total: number;
  failed: number;
}

export function useVerifyAllEmailsStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["emails", "verify-all-status"],
    queryFn: async () => {
      const { data } = await apiClient.get<VerifyAllEmailsStatus>("/emails/verify-all/status");
      return data;
    },
    enabled,
    refetchInterval: enabled ? 1500 : false,
  });
}
