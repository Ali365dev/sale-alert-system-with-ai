import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

export interface Category {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string | null;
  brand_count: number;
  offer_count: number;
}

export interface CategoriesResponse {
  categories: Category[];
}

export type CategoryInput = {
  name?: string;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
};

export function useCategories(includeInactive = false, region: string | null = null) {
  return useQuery({
    queryKey: ["categories", includeInactive, region],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (includeInactive) params.include_inactive = "true";
      if (region) params.region = region;
      const { data } = await apiClient.get<CategoriesResponse>("/categories", {
        params: Object.keys(params).length ? params : undefined,
      });
      return data;
    },
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CategoryInput) => {
      const { data } = await apiClient.post<Category>("/categories", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category created.");
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: number; input: CategoryInput }) => {
      const { data } = await apiClient.put<Category>(`/categories/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category updated.");
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category deleted.");
    },
  });
}
