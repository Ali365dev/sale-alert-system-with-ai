import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import { toast } from "../store/toastStore";

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface SessionStatus {
  authenticated: boolean;
  setup_required: boolean;
}

export function useSettingsSession() {
  return useQuery({
    queryKey: ["settings", "session"],
    queryFn: async () => {
      const { data } = await apiClient.get<SessionStatus>("/settings/session");
      return data;
    },
    retry: false,
  });
}

export function useSettingsLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (password: string) => {
      const { data } = await apiClient.post("/settings/login", { password });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}

export function useSettingsLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post("/settings/logout");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });
}

// ── Google account ───────────────────────────────────────────────────────────

export interface GoogleAccountInfo {
  connected: boolean;
  email: string | null;
  messages_total: number | null;
  threads_total: number | null;
  last_sync: string | null;
  error?: string;
}

export function useGoogleAccount() {
  return useQuery({
    queryKey: ["settings", "google-account"],
    queryFn: async () => {
      const { data } = await apiClient.get<GoogleAccountInfo>("/settings/google-account");
      return data;
    },
  });
}

export function useConnectGoogle() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post("/settings/google-account/connect");
      return data;
    },
    onSuccess: () => toast.info("Opening Google sign-in — check the server log if a browser tab doesn't open automatically."),
  });
}

export function useDisconnectGoogle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post("/settings/google-account/disconnect");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "google-account"] });
      toast.success("Google account disconnected.");
    },
  });
}

export interface GmailLabel {
  id: string;
  name: string;
}

export function useGmailLabels(enabled: boolean) {
  return useQuery({
    queryKey: ["settings", "gmail-labels"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ labels: GmailLabel[] }>("/settings/gmail-labels");
      return data.labels;
    },
    enabled,
  });
}

// ── API keys ─────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: number;
  provider: "gemini" | "groq" | "tavily";
  name: string;
  key_preview: string;
  priority: number;
  is_enabled: boolean;
  status: "active" | "disabled" | "invalid";
  daily_usage_count: number;
  last_used_at: string | null;
  last_tested_at: string | null;
  last_test_ok: boolean | null;
  last_error: string | null;
  quota_exceeded: boolean;
  created_at: string;
}

export function useApiKeys(provider?: string) {
  return useQuery({
    queryKey: ["settings", "api-keys", provider],
    queryFn: async () => {
      const { data } = await apiClient.get<{ keys: ApiKey[] }>("/settings/api-keys", { params: { provider } });
      return data.keys;
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { provider: string; name: string; key: string; priority?: number }) => {
      const { data } = await apiClient.post<ApiKey>("/settings/api-keys", body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "api-keys"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "providers"] });
      toast.success("API key added.");
    },
  });
}

export function useUpdateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: number; name?: string; priority?: number; is_enabled?: boolean; status?: string; key?: string }) => {
      const { data } = await apiClient.put<ApiKey>(`/settings/api-keys/${id}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "api-keys"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "providers"] });
      toast.success("API key updated.");
    },
  });
}

export function useReorderApiKeys() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (order: number[]) => {
      const { data } = await apiClient.put<{ keys: ApiKey[] }>("/settings/api-keys/reorder", { order });
      return data.keys;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "api-keys"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "providers"] });
      toast.success("Priority updated.");
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.delete(`/settings/api-keys/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "api-keys"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "providers"] });
      toast.success("API key deleted.");
    },
  });
}

export function useTestApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await apiClient.post<{ ok: boolean; error: string | null; latency_seconds: number; rate_limited: boolean }>(
        `/settings/api-keys/${id}/test`,
      );
      return data;
    },
    onSuccess: () => {
      // the test also updates last_error/quota_exceeded server-side — refresh the list
      queryClient.invalidateQueries({ queryKey: ["settings", "api-keys"] });
      queryClient.invalidateQueries({ queryKey: ["settings", "providers"] });
    },
  });
}

// ── Providers ────────────────────────────────────────────────────────────────

export type ProviderName = "gemini" | "groq" | "ollama";

export interface ProviderHealth {
  enabled: boolean;
  healthy: boolean;
  cooldown_seconds_remaining: number | null;
}

export interface ProvidersConfig {
  gemini_model: string;
  groq_model: string;
  gemini_keys: ApiKey[];
  groq_keys: ApiKey[];
  tavily_keys: ApiKey[];
  /** LLM failover order — Gemini/Groq/Ollama only (Tavily is a separate
   * search API, not part of this chain). First entry is tried first. */
  provider_order: ProviderName[];
  /** Independent of provider_order — a disabled provider is skipped
   * entirely regardless of its position in the order. */
  provider_enabled: Record<ProviderName, boolean>;
  provider_names: ProviderName[];
  /** The provider actually in use by the backend right now — usually
   * provider_order[0] among enabled ones, but can trail behind mid-session
   * if a rate-limit failover moved it on since the order last changed. */
  active_provider: ProviderName;
  provider_health: Record<ProviderName, ProviderHealth>;
  provider_requests_today: Record<ProviderName, number>;
}

export function useProviders() {
  return useQuery({
    queryKey: ["settings", "providers"],
    queryFn: async () => {
      const { data } = await apiClient.get<ProvidersConfig>("/settings/providers");
      return data;
    },
    // Health/cooldown state can change on its own (a background AI call can
    // exhaust a provider) — poll gently so the priority card doesn't go stale.
    refetchInterval: 15000,
  });
}

export function useUpdateProviders() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      gemini_model?: string;
      groq_model?: string;
      provider_order?: ProviderName[];
      provider_enabled?: Partial<Record<ProviderName, boolean>>;
    }) => {
      const { data } = await apiClient.put("/settings/providers", body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "providers"] });
      toast.success("Provider settings saved.");
    },
  });
}

// ── Email processing ─────────────────────────────────────────────────────────

export interface EmailProcessingSettings {
  gmail_label: string;
  gmail_brand_label: string;
  max_emails_per_sync: number;
  retry_attempts: number;
  request_timeout_seconds: number;
  auto_analyze_emails: boolean;
  auto_apply_gmail_label: boolean;
  skip_already_labeled: boolean;
  skip_duplicate_emails: boolean;
  ocr_max_images_per_email: number;
  latest_emails_limit: number | null;
  fetch_interval_minutes: number;
  _fetch_interval_wired: boolean;
}

export function useEmailProcessing() {
  return useQuery({
    queryKey: ["settings", "email-processing"],
    queryFn: async () => {
      const { data } = await apiClient.get<EmailProcessingSettings>("/settings/email-processing");
      return data;
    },
  });
}

export function useUpdateEmailProcessing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<EmailProcessingSettings>) => {
      const { data } = await apiClient.put("/settings/email-processing", body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "email-processing"] });
      toast.success("Email processing settings saved.");
    },
  });
}

// ── Prompts ──────────────────────────────────────────────────────────────────

export interface Prompt {
  id: number;
  key: string;
  name: string;
  description: string | null;
  category: string | null;
  content: string;
  default_content: string;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function usePrompts() {
  return useQuery({
    queryKey: ["settings", "prompts"],
    queryFn: async () => {
      const { data } = await apiClient.get<{ prompts: Prompt[] }>("/settings/prompts");
      return data.prompts;
    },
  });
}

export function useUpdatePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, content }: { key: string; content: string }) => {
      const { data } = await apiClient.put<Prompt>(`/settings/prompts/${key}`, { content });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "prompts"] });
      toast.success("Prompt saved.");
    },
  });
}

export function useRestorePromptDefault() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { data } = await apiClient.post<Prompt>(`/settings/prompts/${key}/restore-default`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "prompts"] });
      toast.success("Prompt restored to default.");
    },
  });
}

export function useDuplicatePrompt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { data } = await apiClient.post<Prompt>(`/settings/prompts/${key}/duplicate`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "prompts"] });
      toast.success("Prompt duplicated.");
    },
  });
}

export interface TestPromptInput {
  key: string;
  subject: string;
  body: string;
  brand_name?: string;
  website?: string;
  categories?: string;
}

export function useTestPrompt() {
  return useMutation({
    mutationFn: async ({ key, ...rest }: TestPromptInput) => {
      const { data } = await apiClient.post<{ raw_response: string | null; parsed: unknown }>(
        `/settings/prompts/${key}/test`,
        rest,
      );
      return data;
    },
  });
}

// ── System ───────────────────────────────────────────────────────────────────

export interface SystemSettings {
  timezone: string;
  date_format: string;
  theme: string;
  log_level: string;
}

export function useSystemSettings() {
  return useQuery({
    queryKey: ["settings", "system"],
    queryFn: async () => {
      const { data } = await apiClient.get<SystemSettings>("/settings/system");
      return data;
    },
  });
}

export function useUpdateSystemSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<SystemSettings>) => {
      const { data } = await apiClient.put("/settings/system", body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "system"] });
      toast.success("System settings saved.");
    },
  });
}

// ── Audit log ────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number;
  actor: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export function useAuditLog(limit = 50, offset = 0) {
  return useQuery({
    queryKey: ["settings", "audit-log", limit, offset],
    queryFn: async () => {
      const { data } = await apiClient.get<{ entries: AuditLogEntry[]; total: number }>("/settings/audit-log", {
        params: { limit, offset },
      });
      return data;
    },
  });
}

// ── Import / export ──────────────────────────────────────────────────────────

export function useExportSettings() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get("/settings/export");
      return data;
    },
  });
}

export function useImportSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: unknown) => {
      const { data } = await apiClient.post("/settings/import", body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      toast.success("Settings imported.");
    },
  });
}
