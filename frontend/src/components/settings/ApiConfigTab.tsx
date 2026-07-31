import { useState } from "react";

import {
  useApiKeys,
  useDeleteApiKey,
  useProviders,
  useTestApiKey,
  useUpdateApiKey,
  useUpdateProviders,
  type ApiKey,
} from "../../api/settings";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { Label, TextInput } from "../ui/Field";
import { LoadingState } from "../ui/Spinner";
import { Icon } from "../icons";
import { ApiKeyForm } from "./ApiKeyForm";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  disabled: "neutral",
  invalid: "danger",
};

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

function KeyRow({ apiKey }: { apiKey: ApiKey }) {
  const update = useUpdateApiKey();
  const del = useDeleteApiKey();
  const test = useTestApiKey();

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 140px 90px 100px 100px 200px",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        fontSize: 12.5,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontWeight: 600, color: "var(--text-strong)" }}>{apiKey.name}</span>
        <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)", fontSize: 11.5 }}>{apiKey.key_preview}</span>
      </div>
      <span style={{ color: "var(--text-muted)" }}>Priority {apiKey.priority}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        <Badge tone={STATUS_TONE[apiKey.status] ?? "neutral"}>{apiKey.status}</Badge>
        {apiKey.quota_exceeded && (
          <span title={apiKey.last_error ?? undefined}>
            <Badge tone="warning">quota exceeded</Badge>
          </span>
        )}
      </div>
      <span style={{ font: "600 12px/1 var(--font-mono)" }}>{apiKey.daily_usage_count}</span>
      <span style={{ color: "var(--text-muted)", fontSize: 11.5 }}>{formatDate(apiKey.last_used_at)}</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Button size="sm" variant="secondary" loading={test.isPending} onClick={() => test.mutate(apiKey.id)}>
          Test
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => update.mutate({ id: apiKey.id, is_enabled: !apiKey.is_enabled, status: apiKey.is_enabled ? "disabled" : "active" })}
        >
          {apiKey.is_enabled ? "Disable" : "Enable"}
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => {
            if (window.confirm(`Delete API key "${apiKey.name}"?`)) del.mutate(apiKey.id);
          }}
        >
          Delete
        </Button>
      </div>
      {test.data && (
        <div style={{ gridColumn: "1 / -1", fontSize: 11.5, color: test.data.ok ? "var(--success)" : test.data.rate_limited ? "var(--amber-600)" : "var(--danger)" }}>
          {test.data.ok
            ? `✓ Connected (${test.data.latency_seconds}s)`
            : test.data.rate_limited
              ? `⚠ Rate limit / quota exceeded — ${test.data.error}`
              : `✗ ${test.data.error}`}
        </div>
      )}
    </div>
  );
}

function ProviderSection({
  provider,
  title,
  modelKey,
}: {
  provider: "gemini" | "groq" | "tavily";
  title: string;
  modelKey?: "gemini_model" | "groq_model";
}) {
  const { data: keys, isLoading } = useApiKeys(provider);
  const { data: providers } = useProviders();
  const updateProviders = useUpdateProviders();
  const [addingKey, setAddingKey] = useState(false);
  const [model, setModel] = useState<string | null>(null);

  const currentModel = model ?? (modelKey ? providers?.[modelKey] : undefined);
  const activeCount = keys?.filter((k) => k.is_enabled && k.status !== "invalid").length ?? 0;
  const quotaExceededCount = keys?.filter((k) => k.is_enabled && k.quota_exceeded).length ?? 0;
  const allQuotaExceeded = activeCount > 0 && quotaExceededCount >= activeCount;

  return (
    <Card>
      <CardHeader
        title={title}
        aside={
          <div style={{ display: "flex", gap: 6 }}>
            <Badge tone={activeCount > 0 ? "success" : "neutral"}>
              {activeCount > 0 ? `${activeCount} active key${activeCount === 1 ? "" : "s"}` : "Not configured"}
            </Badge>
            {quotaExceededCount > 0 && (
              <Badge tone="warning">
                {allQuotaExceeded ? "All keys over quota" : `${quotaExceededCount} over quota`}
              </Badge>
            )}
          </div>
        }
      />
      {modelKey && (
        <div style={{ maxWidth: 320 }}>
          <Label>Model</Label>
          <div style={{ display: "flex", gap: 8 }}>
            <TextInput
              value={currentModel ?? ""}
              onChange={(e) => setModel(e.target.value)}
              placeholder="model name"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={model === null}
              loading={updateProviders.isPending}
              onClick={() => updateProviders.mutate({ [modelKey]: model } as Record<string, string>, { onSuccess: () => setModel(null) })}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <LoadingState />
      ) : keys && keys.length > 0 ? (
        <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
          {keys.map((k) => (
            <KeyRow key={k.id} apiKey={k} />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No keys added yet.</div>
      )}

      <div>
        <Button size="sm" onClick={() => setAddingKey(true)}>
          Add key
        </Button>
      </div>

      {addingKey && <ApiKeyForm provider={provider} onClose={() => setAddingKey(false)} />}
    </Card>
  );
}

export function ApiConfigTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 12.5 }}>
        <Icon.sparkle size={14} style={{ color: "var(--ai)" }} />
        Gemini is tried first, then Groq, then a local Llama model — Gemini rotates automatically between multiple
        keys here on quota, rate-limit, auth, or timeout failures before falling back to Groq.
      </div>
      <ProviderSection provider="gemini" title="Gemini" modelKey="gemini_model" />
      <ProviderSection provider="groq" title="Groq" modelKey="groq_model" />
      <ProviderSection provider="tavily" title="Tavily" />
    </div>
  );
}
