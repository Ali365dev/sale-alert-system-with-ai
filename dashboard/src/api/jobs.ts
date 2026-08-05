import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export type JobStatus = "pending" | "running" | "cancelling" | "cancelled" | "completed" | "failed";

export interface Job {
  id: number;
  job_type: string;
  status: JobStatus;
  total_emails: number;
  processed_emails: number;
  total_items: number;
  processed_items: number;
  successful: number;
  failed: number;
  skipped: number;
  current_email_subject: string | null;
  current_item_label: string | null;
  stage: string | null;
  progress_percentage: number;
  estimated_remaining_seconds: number | null;
  processing_speed: number | null;
  worker_count: number;
  cancel_requested: boolean;
  error: string | null;
  payload: Record<string, any> | null;
  result: Record<string, any> | null;
  checkpoint: { last_item_id: any; last_item_label: string } | null;
  is_interrupted: boolean;
  queue_position: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface JobLogEntry {
  id: number;
  time: string;
  message: string;
  severity: "info" | "success" | "warning" | "error";
  category: string | null;
}

export interface JobsSummary {
  running: number;
  queued: number;
  completed_today: number;
  failed_today: number;
  emails_processed_today: number;
  offers_generated_today: number;
  brands_researched_today: number;
  avg_runtime_seconds: number;
  avg_processing_speed: number;
  success_rate: number;
  failure_rate: number;
  per_type: { job_type: string; last_status: JobStatus | null; last_finished_at: string | null; avg_runtime_seconds: number | null }[];
}

const EMAIL_SYNC_TYPE = "email_sync";
const ACTIVE_POLL_MS = 5000; // how often to check for an externally-started job while idle
const RUNNING_POLL_MS = 1000; // how often to poll a job we know is active

export function isJobActive(status: JobStatus | undefined) {
  return status === "pending" || status === "running" || status === "cancelling";
}

/** Detects an already-running job of a given type on mount (page refresh
 * recovery) and keeps checking periodically so a job started elsewhere
 * (e.g. a different tab, or another trigger button for the same type) is
 * picked up too. */
export function useActiveJob(jobType: string) {
  return useQuery({
    queryKey: ["jobs", "active", jobType],
    queryFn: async () => {
      const { data } = await apiClient.get<{ job: Job | null }>("/jobs/active", {
        params: { type: jobType },
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

export function useJobFullLogs(jobId: number | null) {
  return useQuery({
    queryKey: ["jobs", jobId, "logs", "full"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ logs: JobLogEntry[] }>(`/jobs/${jobId}/logs`, {
        params: { full: true },
      });
      return data.logs;
    },
    enabled: false, // fetched on demand (download-logs click), not automatically
  });
}

export function useStartJob(jobType: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload?: Record<string, any>) => {
      const { data } = await apiClient.post<{ jobId: number; status: JobStatus }>(`/jobs/${jobType}/start`, payload ?? {});
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["jobs", "active", jobType], { id: data.jobId, status: data.status });
      queryClient.invalidateQueries({ queryKey: ["jobs", "active", jobType] });
      queryClient.invalidateQueries({ queryKey: ["jobs", "summary"] });
      toast.info("Job started.");
    },
    onError: (error: any) => {
      const job = error?.response?.data?.job as Job | undefined;
      if (job) {
        queryClient.setQueryData(["jobs", "active", jobType], job);
      }
    },
  });
}

/** Thin back-compat wrapper — most existing call sites started as
 * useStartEmailSync(); kept so those don't all need renaming at once. */
export function useStartEmailSync() {
  return useStartJob(EMAIL_SYNC_TYPE);
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

export function useRetryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: number) => {
      const { data } = await apiClient.post<{ jobId: number; status: JobStatus }>(`/jobs/${jobId}/retry`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.info("Retrying job…");
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: number) => {
      const { data } = await apiClient.delete<{ status: string }>(`/jobs/${jobId}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs", "history"] });
      toast.success("Job deleted.");
    },
  });
}

export function useBulkJobAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { action: "delete" | "retry"; ids: number[] }) => {
      const { data } = await apiClient.post("/jobs/bulk", body);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.success(variables.action === "delete" ? "Selected jobs deleted." : "Selected jobs queued for retry.");
    },
  });
}

export interface JobHistoryParams {
  jobType?: string;
  status?: string;
  search?: string;
  sort?: string;
  sortDir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

export function useJobHistory(params: JobHistoryParams) {
  return useQuery({
    queryKey: ["jobs", "history", params],
    queryFn: async () => {
      const { data } = await apiClient.get<{ jobs: Job[]; total: number }>("/jobs", {
        params: {
          job_type: params.jobType,
          status: params.status,
          search: params.search,
          sort: params.sort,
          sort_dir: params.sortDir,
          limit: params.limit ?? 50,
          offset: params.offset ?? 0,
        },
      });
      return data;
    },
  });
}

export function useJobsSummary() {
  return useQuery({
    queryKey: ["jobs", "summary"],
    queryFn: async () => {
      const { data } = await apiClient.get<JobsSummary>("/jobs/summary");
      return data;
    },
    refetchInterval: RUNNING_POLL_MS * 5,
  });
}
