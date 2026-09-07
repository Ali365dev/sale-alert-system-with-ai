import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";

import {
  SOCIAL_PLATFORMS,
  useBrandDiscoveries,
  useBrandDiscovery,
  useDiscardBrandDiscovery,
  useSaveBrandDiscovery,
  useSearchCandidates,
  useStartDiscovery,
  useUpdateBrandDiscovery,
  type BrandDiscovery,
  type DiscoveryStatus,
  type SearchCandidate,
  type SocialPlatform,
} from "../api/brandDiscovery";
import { ProcessingPanel } from "../components/jobs/ProcessingPanel";
import { Icon } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { FieldGroup, Label, TextArea, TextInput } from "../components/ui/Field";
import { Tabs } from "../components/ui/Tabs";

const STATUS_TONE: Record<DiscoveryStatus, "success" | "warning" | "danger" | "neutral" | "brand"> = {
  pending: "neutral",
  discovering: "brand",
  review: "warning",
  saved: "success",
  discarded: "neutral",
  failed: "danger",
};

function sourceLabel(source: string | null | undefined): string {
  if (!source) return "Unknown source";
  return source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function SourceBadge({ source }: { source: string | null | undefined }) {
  return (
    <span style={{ fontSize: 10.5, color: "var(--text-faint)", fontWeight: 600, letterSpacing: "var(--ls-wide)", textTransform: "uppercase" }}>
      {sourceLabel(source)}
    </span>
  );
}

function ConfidenceBar({ value }: { value: number | null }) {
  if (value === null) return <span style={{ color: "var(--text-faint)" }}>—</span>;
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? "var(--success)" : pct >= 40 ? "var(--amber-600)" : "var(--danger)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ width: 44, height: 6, borderRadius: 999, background: "var(--surface-sunken)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
      <span style={{ font: "600 11.5px/1 var(--font-mono)", color }}>{pct}%</span>
    </div>
  );
}

// ── Search Brand tab ─────────────────────────────────────────────────────────

function CandidateCard({ candidate, onPick, picking }: { candidate: SearchCandidate; onPick: () => void; picking: boolean }) {
  return (
    <button
      type="button"
      onClick={onPick}
      disabled={picking}
      style={{
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        textAlign: "left",
        padding: 14,
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm)",
        background: "var(--surface-card)",
        cursor: picking ? "default" : "pointer",
        opacity: picking ? 0.6 : 1,
        width: "100%",
      }}
    >
      <div
        style={{
          width: 44, height: 44, borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)",
          border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden", flexShrink: 0,
        }}
      >
        {candidate.logo_url ? (
          <img
            src={candidate.logo_url}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <Icon.globe size={18} />
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ font: "600 14px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>{candidate.name}</span>
          <Badge tone="neutral">{candidate.category}</Badge>
        </div>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{candidate.domain}</span>
        {candidate.description && (
          <span style={{ fontSize: 12.5, color: "var(--text-body)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {candidate.description}
          </span>
        )}
      </div>
    </button>
  );
}

function SearchBrandTab({
  onStarted,
  initialName,
  brandRequestId,
}: {
  onStarted: (discoveryId: number, jobId: number) => void;
  initialName?: string;
  brandRequestId?: number;
}) {
  const [name, setName] = useState(initialName ?? "");
  const search = useSearchCandidates();
  const start = useStartDiscovery();

  function handleSearch() {
    if (!name.trim()) return;
    search.mutate(name.trim());
  }

  // Landed here from a Brand Request's "Discover" button — run the search
  // immediately instead of making the admin retype the name and click Search.
  useEffect(() => {
    if (initialName) search.mutate(initialName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialName]);

  function handlePick(candidate: SearchCandidate) {
    start.mutate(
      { mode: "search_name", website: candidate.website, seed_name: candidate.name, brand_request_id: brandRequestId },
      { onSuccess: (data) => onStarted(data.discoveryId, data.jobId) },
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, maxWidth: 480 }}>
        <TextInput
          placeholder="Brand name — e.g. Nike"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
        />
        <Button onClick={handleSearch} loading={search.isPending} disabled={!name.trim()}>
          Search
        </Button>
      </div>

      {search.isSuccess && search.data.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          No likely official website found for "{name}" — try Scan Website with a URL you already know instead.
        </p>
      )}

      {search.data && search.data.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {search.data.map((candidate) => (
            <CandidateCard key={candidate.website} candidate={candidate} onPick={() => handlePick(candidate)} picking={start.isPending} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Scan Website tab ─────────────────────────────────────────────────────────

function ScanWebsiteTab({
  onStarted,
  brandRequestId,
}: {
  onStarted: (discoveryId: number, jobId: number) => void;
  brandRequestId?: number;
}) {
  const [url, setUrl] = useState("");
  const start = useStartDiscovery();

  function handleScan() {
    if (!url.trim()) return;
    start.mutate(
      { mode: "scan_website", website: url.trim(), brand_request_id: brandRequestId },
      { onSuccess: (data) => onStarted(data.discoveryId, data.jobId) },
    );
  }

  return (
    <div style={{ display: "flex", gap: 10, maxWidth: 480 }}>
      <TextInput
        placeholder="https://brand-website.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleScan()}
      />
      <Button onClick={handleScan} loading={start.isPending} disabled={!url.trim()}>
        Scan Website
      </Button>
    </div>
  );
}

// ── Review screen ────────────────────────────────────────────────────────────

function SocialLinksEditor({
  discovery,
  onChange,
}: {
  discovery: BrandDiscovery;
  onChange: (platform: SocialPlatform, patch: { url?: string; verified?: boolean } | null) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {SOCIAL_PLATFORMS.map((platform) => {
        const entry = discovery.social_links[platform];
        const PlatformIcon = Icon[platform];
        return (
          <div key={platform} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 26, display: "flex", justifyContent: "center", color: "var(--text-muted)" }}>
              <PlatformIcon size={17} />
            </div>
            <div style={{ flex: 1 }}>
              <TextInput
                placeholder={`${platform.charAt(0).toUpperCase()}${platform.slice(1)} URL`}
                value={entry?.url ?? ""}
                onChange={(e) => onChange(platform, { url: e.target.value })}
              />
            </div>
            {entry && (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                  <input
                    type="checkbox"
                    checked={entry.verified}
                    onChange={(e) => onChange(platform, { verified: e.target.checked })}
                    style={{ width: 15, height: 15 }}
                  />
                  Verified
                </label>
                <SourceBadge source={entry.source} />
                <button
                  type="button"
                  onClick={() => onChange(platform, null)}
                  aria-label={`Remove ${platform}`}
                  style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 4 }}
                >
                  ×
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function DuplicateWarning({ discovery, onDismiss }: { discovery: BrandDiscovery; onDismiss: () => void }) {
  const saveDiscovery = useSaveBrandDiscovery(discovery.id);
  if (!discovery.duplicate_brand_id) return null;

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: 8, padding: 14,
        background: "var(--warning-subtle)", border: "1px solid var(--warning-subtle)", borderRadius: "var(--radius-sm)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--amber-600)", fontWeight: 700, fontSize: 13 }}>
        <Icon.alert size={15} /> Possible duplicate brand
      </div>
      <div style={{ fontSize: 12.5, color: "var(--text-body)" }}>
        This looks similar to an existing brand
        {discovery.duplicate_brand ? (
          <>
            {" "}
            — <strong>{discovery.duplicate_brand.name}</strong>
          </>
        ) : (
          ` (#${discovery.duplicate_brand_id})`
        )}
        {discovery.duplicate_score !== null && <> ({Math.round((discovery.duplicate_score ?? 0) * 100)}% match)</>}
        {discovery.duplicate_reason && <> — matched by {discovery.duplicate_reason.replace(/_/g, " ")}</>}.
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button
          loading={saveDiscovery.isPending}
          onClick={() => saveDiscovery.mutate({ action: "merge", target_brand_id: discovery.duplicate_brand_id! })}
        >
          Merge into existing brand
        </Button>
        <a href="/brands" target="_blank" rel="noreferrer">
          <Button variant="secondary" type="button">
            View existing brand →
          </Button>
        </a>
        <Button variant="ghost" onClick={onDismiss}>
          Create anyway
        </Button>
      </div>
    </div>
  );
}

function ReviewScreen({ discoveryId, onDone }: { discoveryId: number; onDone: () => void }) {
  const { data: discovery } = useBrandDiscovery(discoveryId);
  const update = useUpdateBrandDiscovery(discoveryId);
  const saveDiscovery = useSaveBrandDiscovery(discoveryId);
  const discard = useDiscardBrandDiscovery(discoveryId);
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);

  if (!discovery) return null;

  if (discovery.status === "failed") {
    return (
      <Card>
        <CardHeader title="Could not discover this brand" />
        <p style={{ margin: 0, fontSize: 13, color: "var(--danger)" }}>{discovery.error ?? "Something went wrong."}</p>
        <div>
          <Button variant="ghost" onClick={onDone}>
            Try again
          </Button>
        </div>
      </Card>
    );
  }

  function patchField<K extends "name" | "website" | "logo_url" | "description" | "category" | "subcategory" | "country">(
    field: K,
    value: string,
  ) {
    update.mutate({ [field]: value } as Record<K, string>);
  }

  function patchSocial(platform: SocialPlatform, patch: { url?: string; verified?: boolean } | null) {
    if (!discovery) return;
    if (patch === null) {
      const next = { ...discovery.social_links };
      delete next[platform];
      update.mutate({ social_links: Object.fromEntries(Object.entries(next).map(([p, e]) => [p, { url: e!.url, verified: e!.verified }])) });
      return;
    }
    const current = discovery.social_links[platform];
    const url = patch.url ?? current?.url ?? "";
    const verified = patch.verified ?? current?.verified ?? false;
    const nextLinks = { ...discovery.social_links, [platform]: { url, source: current?.source ?? "manual_entry", verified } };
    update.mutate({
      social_links: Object.fromEntries(
        Object.entries(nextLinks).filter(([, e]) => e.url.trim()).map(([p, e]) => [p, { url: e.url, verified: e.verified }]),
      ),
    });
  }

  const showDuplicate = !!discovery.duplicate_brand_id && !skipDuplicateCheck && discovery.status !== "saved";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {discovery.status === "saved" && (
        <div style={{ padding: 12, borderRadius: "var(--radius-sm)", background: "var(--success-subtle)", color: "var(--success)", fontSize: 13, fontWeight: 600 }}>
          Saved to Brands — this discovery is complete.
        </div>
      )}

      {showDuplicate && <DuplicateWarning discovery={discovery} onDismiss={() => setSkipDuplicateCheck(true)} />}

      <Card>
        <CardHeader
          title="Brand Profile"
          aside={<ConfidenceBar value={discovery.confidence} />}
        />
        <div style={{ display: "flex", gap: 16 }}>
          <div
            style={{
              width: 72, height: 72, borderRadius: "var(--radius-sm)", background: "var(--surface-sunken)",
              border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", flexShrink: 0,
            }}
          >
            {discovery.logo_url ? (
              <img
                src={discovery.logo_url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <Icon.globe size={24} />
            )}
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <FieldGroup>
                <Label>Brand name</Label>
                <TextInput defaultValue={discovery.name ?? ""} onBlur={(e) => patchField("name", e.target.value)} />
                <SourceBadge source={discovery.field_sources.name} />
              </FieldGroup>
              <FieldGroup>
                <Label>Official website</Label>
                <TextInput defaultValue={discovery.website ?? ""} onBlur={(e) => patchField("website", e.target.value)} />
                <SourceBadge source={discovery.field_sources.website} />
              </FieldGroup>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <FieldGroup>
                <Label>Category</Label>
                <TextInput defaultValue={discovery.category ?? ""} onBlur={(e) => patchField("category", e.target.value)} />
                <SourceBadge source={discovery.field_sources.category} />
              </FieldGroup>
              <FieldGroup>
                <Label>Subcategory</Label>
                <TextInput defaultValue={discovery.subcategory ?? ""} onBlur={(e) => patchField("subcategory", e.target.value)} />
                <SourceBadge source={discovery.field_sources.subcategory} />
              </FieldGroup>
              <FieldGroup>
                <Label>Country</Label>
                <TextInput defaultValue={discovery.country ?? ""} onBlur={(e) => patchField("country", e.target.value)} />
                <SourceBadge source={discovery.field_sources.country} />
              </FieldGroup>
            </div>
            <FieldGroup>
              <Label>Logo URL</Label>
              <TextInput defaultValue={discovery.logo_url ?? ""} onBlur={(e) => patchField("logo_url", e.target.value)} />
              <SourceBadge source={discovery.field_sources.logo_url} />
            </FieldGroup>
            <FieldGroup>
              <Label>Description</Label>
              <TextArea defaultValue={discovery.description ?? ""} onBlur={(e) => patchField("description", e.target.value)} />
              <SourceBadge source={discovery.field_sources.description} />
            </FieldGroup>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Social Media Accounts" />
        <SocialLinksEditor discovery={discovery} onChange={patchSocial} />
      </Card>

      {discovery.status !== "saved" && (
        <div style={{ display: "flex", gap: 10 }}>
          <Button loading={saveDiscovery.isPending} onClick={() => saveDiscovery.mutate({ action: "create" })}>
            Save to Brands
          </Button>
          <Button variant="ghost" onClick={() => discard.mutate(undefined, { onSuccess: onDone })}>
            Discard
          </Button>
        </div>
      )}
      {discovery.status === "saved" && (
        <div>
          <Button variant="secondary" onClick={onDone}>
            Start another discovery
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Recent discoveries ───────────────────────────────────────────────────────

function RecentDiscoveries({ onOpen }: { onOpen: (id: number) => void }) {
  const { data } = useBrandDiscoveries();
  const items = (data ?? []).filter((d) => d.status !== "discarded");
  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader title="Recent Discoveries" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.slice(0, 8).map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onOpen(d.id)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
              padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
              background: "var(--surface-card)", cursor: "pointer", textAlign: "left",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {d.name ?? d.query}
            </span>
            <Badge tone={STATUS_TONE[d.status]}>{d.status}</Badge>
          </button>
        ))}
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DiscoverBrand() {
  const [searchParams] = useSearchParams();
  const requestIdParam = searchParams.get("requestId");
  const brandRequestId = requestIdParam ? Number(requestIdParam) : undefined;
  const requestedName = searchParams.get("name") ?? undefined;

  const [tab, setTab] = useState("search");
  const [activeDiscoveryId, setActiveDiscoveryId] = useState<number | null>(null);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const { data: activeDiscovery } = useBrandDiscovery(activeDiscoveryId);

  function reset() {
    setActiveDiscoveryId(null);
    setActiveJobId(null);
  }

  function handleStarted(discoveryId: number, jobId: number) {
    setActiveDiscoveryId(discoveryId);
    setActiveJobId(jobId);
  }

  const isDiscovering = activeDiscovery?.status === "pending" || activeDiscovery?.status === "discovering";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
        Search for a brand by name, or scan its website directly — free web scraping only, no AI/search-API cost.
        Review everything before it's saved to Brands.
      </p>

      {brandRequestId !== undefined && (
        <div style={{ padding: "10px 14px", borderRadius: "var(--radius-sm)", background: "var(--brand-subtle)", color: "var(--brand)", fontSize: 12.5, fontWeight: 600 }}>
          Resolving Brand Request #{brandRequestId}
          {requestedName ? ` — "${requestedName}"` : ""}. Saving here will mark that request as Added.
        </div>
      )}

      {activeDiscoveryId === null && (
        <>
          <Tabs
            tabs={[
              { id: "search", label: "Search Brand" },
              { id: "scan", label: "Scan Website" },
            ]}
            active={tab}
            onChange={setTab}
          />
          {tab === "search" && <SearchBrandTab onStarted={handleStarted} initialName={requestedName} brandRequestId={brandRequestId} />}
          {tab === "scan" && <ScanWebsiteTab onStarted={handleStarted} brandRequestId={brandRequestId} />}
          <RecentDiscoveries onOpen={setActiveDiscoveryId} />
        </>
      )}

      {activeDiscoveryId !== null && activeJobId !== null && isDiscovering && (
        <ProcessingPanel jobId={activeJobId} onDismiss={reset} />
      )}

      {activeDiscoveryId !== null && activeDiscovery && !isDiscovering && (
        <ReviewScreen discoveryId={activeDiscoveryId} onDone={reset} />
      )}
    </div>
  );
}
