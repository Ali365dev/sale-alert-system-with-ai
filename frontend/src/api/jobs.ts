import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export type JobStatus = "pending" | "running" | "completed" | "cancelled" | "failed";

export interface Job {
  id: number;
  job_type: string;
  status: JobStatus;
  total_emails: number;
  processed_emails: number;
  successful: number;
  failed: number;
  skipped: number;
  current_email_subject: string | null;
  progress_percentage: number;
  estimated_remaining_seconds: number | null;
  worker_count: number;
  cancel_requested: boolean;
  error: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface JobLogEntry {
  id: number;
  time: string;
  message: string;
}

const EMAIL_SYNC_TYPE = "email_sync";
const ACTIVE_POLL_MS = 5000; // how often to check for an externally-started job while idle
const RUNNING_POLL_MS = 1000; // how often to poll a job we know is active

export function isJobActive(status: JobStatus | undefined) {
  return status === "pending" || status === "running";
}

/** Detects an already-running job on mount (page refresh recovery) and keeps
 * checking periodically so a job started elsewhere is picked up too. */
export function useActiveJob() {
  return useQuery({
    queryKey: ["jobs", "active", EMAIL_SYNC_TYPE],
    queryFn: async () => {
      const { data } = await apiClient.get<{ job: Job | null }>("/jobs/active", {
        params: { type: EMAIL_SYNC_TYPE },
      });
      return data.job;
    },
    refetchInterval: (query) => (isJobActive(query.state.data?.status) ? false : ACTIVE_POLL_MS),
  });
}

export function useJob(jobId: number | null) {
  return useQuery({
    queryKey: ["jobs", jobId],
    queryFn: async () => {
      const { data } = await apiClient.get<Job>(`/jobs/${jobId}`);
      return data;
    },
    enabled: jobId !== null,
    refetchInterval: (query) => (isJobActive(query.state.data?.status) ? RUNNING_POLL_MS : false),
  });
}

export function useJobLogs(jobId: number | null, active: boolean) {
  return useQuery({
    queryKey: ["jobs", jobId, "logs"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ logs: JobLogEntry[] }>(`/jobs/${jobId}/logs`);
      return data.logs;
    },
    enabled: jobId !== null,
    refetchInterval: active ? RUNNING_POLL_MS : false,
  });
}

export function useStartEmailSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (workers?: number) => {
      const { data } = await apiClient.post<{ jobId: number; status: JobStatus }>("/jobs/email-sync", {
        workers,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["jobs", "active", EMAIL_SYNC_TYPE], {
        id: data.jobId,
        status: data.status,
      });
      queryClient.invalidateQueries({ queryKey: ["jobs", "active", EMAIL_SYNC_TYPE] });
      toast.info("Email analysis started.");
    },
    onError: (error: any) => {
      const job = error?.response?.data?.job as Job | undefined;
      if (job) {
        queryClient.setQueryData(["jobs", "active", EMAIL_SYNC_TYPE], job);
      }
    },
  });
}

export function useCancelJob(jobId: number | null) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<{ status: string }>(`/jobs/${jobId}/cancel`);
      return data;
    },
    onSuccess: () => toast.info("Cancelling…"),
  });
}
