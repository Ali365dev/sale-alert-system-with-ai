import { useMutation, useQuery } from "@tanstack/react-query";
import { AxiosError } from "axios";

import { apiClient } from "./client";
import type { AuthUser } from "../store/authStore";
import { useAuthStore } from "../store/authStore";

interface AuthResponse {
  token: string;
  user: AuthUser;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    return (error.response?.data as { error?: string } | undefined)?.error ?? fallback;
  }
  return fallback;
}

export function useSignup() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (body: { email: string; password: string; name?: string }) => {
      const { data } = await apiClient.post<AuthResponse>("/auth/signup", body);
      return data;
    },
    onSuccess: (data) => setAuth(data.token, data.user),
  });
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (body: { email: string; password: string }) => {
      const { data } = await apiClient.post<AuthResponse>("/auth/login", body);
      return data;
    },
    onSuccess: (data) => setAuth(data.token, data.user),
  });
}

export function useGoogleLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  return useMutation({
    mutationFn: async (idToken: string) => {
      const { data } = await apiClient.post<AuthResponse>("/auth/google", { id_token: idToken });
      return data;
    },
    onSuccess: (data) => setAuth(data.token, data.user),
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  return () => {
    clearAuth();
    apiClient.post("/auth/logout").catch(() => {});
  };
}

/** Account + data deletion, required by Google Play's User Data policy for
 * any app that supports account creation — this is the "web page where a
 * user can request deletion without needing the app installed" leg of that
 * requirement (dealplusApp's Profile screen is the in-app leg). */
export function useDeleteAccount() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  return useMutation({
    mutationFn: async () => {
      await apiClient.delete("/auth/me");
    },
    onSuccess: () => clearAuth(),
  });
}

export function useMe() {
  const token = useAuthStore((s) => s.token);
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const { data } = await apiClient.get<AuthUser>("/auth/me");
      return data;
    },
    enabled: Boolean(token),
    retry: false,
  });
}

export { errorMessage };
