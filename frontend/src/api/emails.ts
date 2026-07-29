import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export interface EmailSummary {
  id: number;
  sender: string;
  subject: string;
  received_date: string | null;
  processed_at: string | null;
  status: string | null;
  note: string | null;
  verified_at: string | null;
  offers_count: number;
  image_count: number;
}

export interface EmailDetail extends EmailSummary {
  body: string | null;
  image_urls: string[];
}

export interface EmailsResponse {
  emails: EmailSummary[];
  summary: {
    total: number;
    unverified: number;
    legitimate: number;
    suspicious: number;
    spam: number;
  };
}

export function useEmails(status?: string) {
  return useQuery({
    queryKey: ["emails", status],
    queryFn: async () => {
      const { data } = await apiClient.get<EmailsResponse>("/emails", {
        params: status ? { status } : undefined,
      });
      return data;
    },
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
    mutationFn: async () => {
      const { data } = await apiClient.post<{ status: string }>("/emails/verify-all");
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
