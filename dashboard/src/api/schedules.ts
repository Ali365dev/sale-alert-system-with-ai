import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { scraperClient } from "./client";

export interface ScrapingSchedule {
  id: number;
  brand_id: number;
  config_id: number | null;
  name: string;
  cron_expr: string;
  timezone: string;
  enabled: boolean;
  last_run_at: string | null;
  last_job_id: number | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ScheduleInput = Partial<Omit<ScrapingSchedule, "id" | "last_run_at" | "last_job_id" | "created_at" | "updated_at">>;

export function useSchedules(brandId?: number) {
  return useQuery({
    queryKey: ["schedules", brandId],
    queryFn: async () => {
      const params: Record<string, unknown> = {};
      if (brandId) params.brand_id = brandId;
      const res = await scraperClient.get("/schedules", { params });
      return res.data as { schedules: ScrapingSchedule[] };
    },
  });
}

export function useCreateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ScheduleInput) => scraperClient.post("/schedules", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ScheduleInput }) =>
      scraperClient.put(`/schedules/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });
}

export function useDeleteSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scraperClient.delete(`/schedules/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["schedules"] }),
  });
}

export function useRunScheduleNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => scraperClient.post(`/schedules/${id}/run-now`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}
