import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export type BrandRequestStatus = "pending" | "added" | "rejected";

export interface BrandRequest {
  id: number;
  device_id: string | null;
  brand_name: string;
  category: string | null;
  note: string | null;
  status: BrandRequestStatus;
  created_at: string | null;
  resolved_at: string | null;
}

export interface BrandRequestsResponse {
  requests: BrandRequest[];
}

export function useBrandRequests() {
  return useQuery({
    queryKey: ["brand-requests"],
    queryFn: async () => {
      const { data } = await apiClient.get<BrandRequestsResponse>("/brand-requests");
      return data;
    },
  });
}

export function useUpdateBrandRequestStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: BrandRequestStatus }) => {
      const { data } = await apiClient.put<BrandRequest>(`/brand-requests/${id}`, { status });
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["brand-requests"] });
      const label = data.status === "added" ? "Marked as added." : data.status === "rejected" ? "Marked as rejected." : "Reopened.";
      toast.success(label);
    },
  });
}
