import { useState } from "react";

import {
  useDeleteApiKey,
  useProviders,
  useReorderApiKeys,
  useTestApiKey,
  useUpdateApiKey,
  useUpdateProviders,
  type ApiKey,
  type ProviderHealth,
  type ProviderName,
} from "../../api/settings";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { Label, Select, TextInput } from "../ui/Field";
import { LoadingState } from "../ui/Spinner";
import { Icon } from "../icons";
import { ApiKeyForm } from "./ApiKeyForm";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  disabled: "neutral",
  invalid: "danger",
};

const PROVIDER_LABELS: Record<ProviderName, { name: string; description: string }> = {
  gemini: { name: "Gemini", description: "Google Gemini — supports multiple rotating keys" },
  groq: { name: "Groq", description: "Fast Llama-family inference via Groq" },
  ollama: { name: "Ollama (local)", description: "Local model — no API key or cost, last resort fallback" },
};

const PROVIDERS_WITH_KEYS: ProviderName[] = ["gemini", "groq"];

const priorityFieldStyle: React.CSSProperties = {
  height: 32,
  padding: "0 8px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-app)",
  color: "var(--text-strong)",
  fontSize: 12,
  fontWeight: 600,
};

function positionLabel(i: number) {
  if (i === 0) return "1st (used)";
  if (i === 1) return "2nd";
  if (i === 2) return "3rd";
  return `${i + 1}th`;
}

/** Move `item` to `toIndex` within `list` and return the new order. */
function reorderList<T>(list: T[], item: T, toIndex: number): T[] {
  const copy = [...list];
  const fromIndex = copy.indexOf(item);
  if (fromIndex === -1) return copy;
  copy.splice(fromIndex, 1);
  copy.splice(Math.min(Math.max(toIndex, 0), copy.length), 0, item);
  return copy;
}

/** Move `keyId` to `toIndex` within `keys` (already priority-ordered) and
 * return the full new id order — priority becomes each id's index in it.
 * Position 0 is "the current active key" for that provider. */
function reorderIds(keys: ApiKey[], keyId: number, toIndex: number): number[] {
  return reorderList(
    keys.map((k) => k.id),
    keyId,
    toIndex,
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

function healthBadge(health?: ProviderHealth): { text: string; tone: "success" | "warning" | "neutral" } | null {
  if (!health) return null;
  if (!health.enabled) return { text: "Disabled", tone: "neutral" };
  if (!health.healthy) {
    const minutes = Math.max(1, Math.ceil((health.cooldown_seconds_remaining ?? 0) / 60));
    return { text: `Cooling down (~${minutes}m)`, tone: "warning" };
  }
  return { text: "Healthy", tone: "success" };
}

function KeyRow({ apiKey, keys, onReorder, reordering }: { apiKey: ApiKey; keys: ApiKey[]; onReorder: (order: number[]) => void; reordering: boolean }) {
  const update = useUpdateApiKey();
  const del = useDeleteApiKey();
  const test = useTestApiKey();
  const position = keys.findIndex((k) => k.id === apiKey.id);

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
      {keys.length > 1 ? (
        <select
          value={position}
          disabled={reordering}
          onChange={(e) => onReorder(reorderIds(keys, apiKey.id, Number(e.target.value)))}
          style={priorityFieldStyle}
          aria-label={`Priority for ${apiKey.name}`}
        >
          {keys.map((_, i) => (
            <option key={i} value={i}>
              {positionLabel(i)}
            </option>
          ))}
        </select>
      ) : (
        <span style={{ color: "var(--text-muted)" }}>Only key</span>
      )}
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
  // Reuses the already-fetched /settings/providers response instead of a
  // separate /settings/api-keys?provider=… call — that endpoint returns the
  // exact same gemini_keys/groq_keys/tavily_keys, so a dedicated fetch here
  // was pure duplicate round-trips to the (remote) database.
  const { data: providers, isLoading } = useProviders();
  const keys = provider === "gemini" ? providers?.gemini_keys : provider === "groq" ? providers?.groq_keys : providers?.tavily_keys;
  const updateProviders = useUpdateProviders();
  const reorder = useReorderApiKeys();
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
            <KeyRow key={k.id} apiKey={k} keys={keys} onReorder={(order) => reorder.mutate(order)} reordering={reorder.isPending} />
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

function ProviderActiveKeySelect({ keys }: { keys: ApiKey[] }) {
  const reorder = useReorderApiKeys();
  if (keys.length === 0) {
    return <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>No keys added</span>;
  }
  const activeId = keys[0].id;
  return (
    <select
      value={activeId}
      disabled={reorder.isPending}
      onChange={(e) => reorder.mutate(reorderIds(keys, Number(e.target.value), 0))}
      style={priorityFieldStyle}
      aria-label="Current active API key"
    >
      {keys.map((k) => (
        <option key={k.id} value={k.id}>
          {k.name}
        </option>
      ))}
    </select>
  );
}

function ProviderPriorityCard() {
  const { data: providers, isLoading } = useProviders();
  const updateProviders = useUpdateProviders();

  const order = providers?.provider_order ?? [];
  const active = providers?.active_provider;

  function keysFor(name: ProviderName): ApiKey[] {
    if (name === "gemini") return providers?.gemini_keys ?? [];
    if (name === "groq") return providers?.groq_keys ?? [];
    return [];
  }

  return (
    <Card>
      <CardHeader
        icon={<Icon.sparkle size={16} style={{ color: "var(--ai)" }} />}
        title="AI provider priority"
        aside={active && <Badge tone="brand">Active now: {PROVIDER_LABELS[active]?.name ?? active}</Badge>}
      />
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
        Which AI is tried first. Within a provider, every enabled key is tried — starting with its active key below —
        before moving on to the next provider here, on a quota, rate-limit, auth, or timeout error.
      </p>
      {isLoading ? (
        <LoadingState />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {order.map((name, i) => {
            const health = healthBadge(providers?.provider_health[name]);
            const keys = keysFor(name);
            const enabled = providers?.provider_enabled[name] ?? true;
            return (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  flexWrap: "wrap",
                  padding: "10px 14px",
                  border: `1px solid ${name === active ? "var(--brand)" : "var(--border)"}`,
                  borderRadius: "var(--radius-sm)",
                  background: name === active ? "var(--brand-subtle)" : "var(--surface-app)",
                  opacity: enabled ? 1 : 0.6,
                }}
              >
                <select
                  value={i}
                  disabled={updateProviders.isPending}
                  onChange={(e) => updateProviders.mutate({ provider_order: reorderList(order, name, Number(e.target.value)) })}
                  style={priorityFieldStyle}
                  aria-label={`Priority for ${PROVIDER_LABELS[name]?.name ?? name}`}
                >
                  {order.map((_, j) => (
                    <option key={j} value={j}>
                      {positionLabel(j)}
                    </option>
                  ))}
                </select>

                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-muted)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    disabled={updateProviders.isPending}
                    onChange={(e) => updateProviders.mutate({ provider_enabled: { [name]: e.target.checked } })}
                  />
                  Enabled
                </label>

                <div style={{ flex: "1 1 170px", minWidth: 150 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-strong)" }}>{PROVIDER_LABELS[name]?.name ?? name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{PROVIDER_LABELS[name]?.description}</div>
                </div>

                {PROVIDERS_WITH_KEYS.includes(name) && (
                  <div>
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "var(--ls-wide)",
                        color: "var(--text-faint)",
                        marginBottom: 3,
                      }}
                    >
                      Active key
                    </div>
                    <ProviderActiveKeySelect keys={keys} />
                  </div>
                )}

                {health && <Badge tone={health.tone}>{health.text}</Badge>}

                <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>
                  {providers?.provider_requests_today[name] ?? 0} req today
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function ActiveKeyOverrideCard() {
  const { data: providers } = useProviders();
  const reorder = useReorderApiKeys();
  const [provider, setProvider] = useState<ProviderName>("gemini");
  const [keyId, setKeyId] = useState<number | "">("");

  const keys = provider === "gemini" ? providers?.gemini_keys ?? [] : providers?.groq_keys ?? [];
  const currentActiveId = keys[0]?.id;

  return (
    <Card>
      <CardHeader icon={<Icon.target size={16} style={{ color: "var(--brand)" }} />} title="Active API key override" />
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
        Manually pick which key a provider starts with — completely independent of provider priority above. This
        only changes that one provider&apos;s active key; it never reorders providers, disables anything, or
        changes the failover sequence.
      </p>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ minWidth: 160 }}>
          <Label>Provider</Label>
          <Select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value as ProviderName);
              setKeyId("");
            }}
          >
            {PROVIDERS_WITH_KEYS.map((p) => (
              <option key={p} value={p}>
                {PROVIDER_LABELS[p].name}
              </option>
            ))}
          </Select>
        </div>
        <div style={{ minWidth: 200 }}>
          <Label>API key</Label>
          <Select value={keyId} onChange={(e) => setKeyId(Number(e.target.value))} disabled={keys.length === 0}>
            <option value="" disabled>
              {keys.length ? "Choose a key…" : "No keys for this provider"}
            </option>
            {keys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
                {k.id === currentActiveId ? " (current active)" : ""}
              </option>
            ))}
          </Select>
        </div>
        <Button
          size="sm"
          disabled={keyId === "" || keyId === currentActiveId}
          loading={reorder.isPending}
          onClick={() => {
            if (keyId === "") return;
            reorder.mutate(reorderIds(keys, keyId, 0), { onSuccess: () => setKeyId("") });
          }}
        >
          Set as active
        </Button>
      </div>
    </Card>
  );
}

export function ApiConfigTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <ProviderPriorityCard />
      <ActiveKeyOverrideCard />
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 12.5 }}>
        <Icon.sparkle size={14} style={{ color: "var(--ai)" }} />
        Within a provider, all keys below are tried starting from its active key — pick a key&apos;s position to
        fine-tune the order for the remaining keys, rotating automatically on quota, rate-limit, auth, or timeout
        failures.
      </div>
      <ProviderSection provider="gemini" title="Gemini" modelKey="gemini_model" />
      <ProviderSection provider="groq" title="Groq" modelKey="groq_model" />
      <ProviderSection provider="tavily" title="Tavily" />
    </div>
  );
}
