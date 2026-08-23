import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export function useDeviceCount() {
  return useQuery({
    queryKey: ["notifications", "device-count"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ count: number }>("/notifications/devices/count");
      return data.count;
    },
  });
}

export function useFcmStatus() {
  return useQuery({
    queryKey: ["notifications", "fcm-status"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ configured: boolean }>("/notifications/fcm-status");
      return data.configured;
    },
  });
}

export function useSaveFcmConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (serviceAccountJson: string) => {
      const { data } = await apiClient.post("/notifications/fcm-config", { service_account_json: serviceAccountJson });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "fcm-status"] });
      toast.success("Firebase credentials saved.");
    },
  });
}

export interface SendNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export function useSendNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SendNotificationPayload) => {
      const { data } = await apiClient.post<{ jobId: number; status: string }>("/notifications/send", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      toast.info("Sending notification…");
    },
    onError: (error: any) => {
      const job = error?.response?.data?.job;
      if (job) {
        queryClient.setQueryData(["jobs", job.id], job);
      }
    },
  });
}
