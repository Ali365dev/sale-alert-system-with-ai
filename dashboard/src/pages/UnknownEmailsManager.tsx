import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";

import { useBrands } from "../api/brands";
import { isJobActive, useActiveJob, useJob, useStartJob } from "../api/jobs";
import {
  parseSender,
  useAddBrandFromCandidate,
  useBulkUnknownEmailAction,
  useDeleteUnknownEmail,
  useIgnoreUnknownEmail,
  useUnknownEmail,
  useUnknownEmails,
  type UnknownEmail,
  type UnknownEmailStatus,
} from "../api/unknownEmails";
import { Icon } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Label, Select, TextArea, TextInput } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { StatCard } from "../components/ui/StatCard";

const PAGE_SIZES = [10, 25, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 400;

const STATUS_TONE: Record<UnknownEmailStatus, "success" | "warning" | "danger" | "neutral" | "brand"> = {
  pending: "warning",
  analyzed: "brand",
  resolved: "success",
  ignored: "neutral",
};

const STATUS_LABEL: Record<UnknownEmailStatus, string> = {
  pending: "Pending",
  analyzed: "AI Completed",
  resolved: "Brand Added",
  ignored: "Ignored",
};

function aiStatusFor(c: UnknownEmail): { label: string; tone: "success" | "warning" | "danger" | "neutral" | "brand" } {
  if (c.analysis_error) return { label: "Failed", tone: "danger" };
  if (c.status === "pending") return { label: "Not analyzed", tone: "neutral" };
  if (c.status === "analyzed") return { label: "Analyzed", tone: "brand" };
  if (c.status === "resolved") return { label: "Analyzed", tone: "success" };
  return { label: "—", tone: "neutral" };
}

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

/** Shared runner for the discover_brand_candidates job — the backend only
 * ever allows one instance of a given job_type to run at a time, so a single
 * hook instance at the page level (rather than one per row) mirrors that and
 * lets every Analyze trigger (row, bulk, "Analyze all pending") share one
 * progress readout instead of each polling independently. */
function useDiscoverJobRunner() {
  const queryClient = useQueryClient();
  const startJob = useStartJob("discover_brand_candidates");
  const active = useActiveJob("discover_brand_candidates");
  const [visibleJobId, setVisibleJobId] = useState<number | null>(null);

  useEffect(() => {
    if (active.data && visibleJobId === null) setVisibleJobId(active.data.id);
  }, [active.data, visibleJobId]);

  const watched = useJob(visibleJobId);
  const running = isJobActive(watched.data?.status);

  const wasActive = useRef(false);
  useEffect(() => {
    if (wasActive.current && !running) {
      queryClient.invalidateQueries({ queryKey: ["unknown-emails"] });
    }
    wasActive.current = running;
  }, [running, queryClient]);

  return {
    running,
    job: watched.data,
    starting: startJob.isPending,
    start: (candidateIds?: number[]) =>
      startJob.mutate(candidateIds ? { candidate_ids: candidateIds } : {}, {
        onSuccess: (data) => setVisibleJobId(data.jobId),
      }),
  };
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

function ImageGallery({ urls, size = 84 }: { urls: string[]; size?: number }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {urls.map((url) => (
        <a key={url} href={url} target="_blank" rel="noreferrer">
          <img
            src={url}
            alt=""
            loading="lazy"
            style={{
              width: size,
              height: size,
              objectFit: "cover",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--surface-sunken)",
            }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        </a>
      ))}
    </div>
  );
}

/** "Add Brand" form, pre-filled from the AI suggestion. If the candidate has
 * a possible-duplicate match, an interstitial warning is shown first with
 * the choice to link to that existing brand instead of creating a new one. */
function AddBrandModal({ candidate, onClose }: { candidate: UnknownEmail; onClose: () => void }) {
  const { data: brandsData } = useBrands();
  const addBrand = useAddBrandFromCandidate();
  const suggestion = candidate.suggestion;
  const existingBrand = candidate.duplicate ? brandsData?.brands.find((b) => b.id === candidate.duplicate!.brand_id) : undefined;
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);

  const [form, setForm] = useState({
    name: suggestion?.name ?? "",
    website: suggestion?.website ?? "",
    category: suggestion?.category ?? "",
    logo_url: suggestion?.logo_url ?? "",
    country: suggestion?.country ?? "",
    description: "",
    instagram: suggestion?.socials?.instagram ?? "",
    twitter: suggestion?.socials?.twitter ?? "",
    facebook: suggestion?.socials?.facebook ?? "",
    linkedin: suggestion?.socials?.linkedin ?? "",
    is_active: true,
  });
  const update = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const showDuplicateWarning = !!candidate.duplicate && !skipDuplicateCheck;

  function handleUseExisting() {
    if (!candidate.duplicate) return;
    addBrand.mutate(
      { id: candidate.id, input: { link_existing_brand_id: candidate.duplicate.brand_id } },
      { onSuccess: onClose },
    );
  }

  function handleCreate() {
    if (!form.name.trim()) return;
    addBrand.mutate(
      {
        id: candidate.id,
        input: {
          name: form.name.trim(),
          website: form.website.trim() || null,
          category: form.category.trim() || null,
          logo_url: form.logo_url.trim() || null,
          description: form.description.trim() || null,
          country: form.country.trim() || null,
          social_links: {
            instagram: form.instagram.trim() || null,
            twitter: form.twitter.trim() || null,
            facebook: form.facebook.trim() || null,
            linkedin: form.linkedin.trim() || null,
          },
          is_active: form.is_active,
        },
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Modal title={`Add Brand — ${candidate.subject}`} onClose={onClose}>
      {showDuplicateWarning ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              padding: 14,
              background: "var(--warning-subtle)",
              border: "1px solid var(--warning-subtle)",
              borderRadius: "var(--radius-sm)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--amber-600)", fontWeight: 700, fontSize: 13 }}>
              <Icon.alert size={15} /> Possible duplicate brand
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-body)" }}>
              This looks similar to an existing brand
              {existingBrand ? <> — <strong>{existingBrand.name}</strong></> : ` (#${candidate.duplicate!.brand_id})`}
              {candidate.duplicate!.score !== null && <> ({Math.round((candidate.duplicate!.score ?? 0) * 100)}% match</>}
              {candidate.duplicate!.score !== null && ")"}
              {candidate.duplicate!.reason && <> — matched by {candidate.duplicate!.reason.replace(/_/g, " ")}</>}.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button loading={addBrand.isPending} onClick={handleUseExisting}>
              Use existing brand
            </Button>
            <Link to="/brands">
              <Button variant="secondary" type="button">
                View existing brand →
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => setSkipDuplicateCheck(true)}>
              Create anyway
            </Button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <Label>Brand name *</Label>
              <TextInput value={form.name} onChange={(e) => update({ name: e.target.value })} />
            </div>
            <div>
              <Label>Website</Label>
              <TextInput value={form.website} onChange={(e) => update({ website: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <Label>Category</Label>
              <TextInput value={form.category} onChange={(e) => update({ category: e.target.value })} />
            </div>
            <div>
              <Label>Country</Label>
              <TextInput value={form.country} onChange={(e) => update({ country: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Logo URL</Label>
            <TextInput value={form.logo_url} onChange={(e) => update({ logo_url: e.target.value })} />
          </div>
          <div>
            <Label>Description</Label>
            <TextArea value={form.description} onChange={(e) => update({ description: e.target.value })} />
          </div>
          <div>
            <Label>Sender domain (auto-linked)</Label>
            <TextInput value={candidate.sender_domain ?? ""} disabled />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <Label>Instagram</Label>
              <TextInput value={form.instagram} onChange={(e) => update({ instagram: e.target.value })} />
            </div>
            <div>
              <Label>Twitter / X</Label>
              <TextInput value={form.twitter} onChange={(e) => update({ twitter: e.target.value })} />
            </div>
            <div>
              <Label>Facebook</Label>
              <TextInput value={form.facebook} onChange={(e) => update({ facebook: e.target.value })} />
            </div>
            <div>
              <Label>LinkedIn</Label>
              <TextInput value={form.linkedin} onChange={(e) => update({ linkedin: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={form.is_active} onChange={(e) => update({ is_active: e.target.checked })} style={{ width: 18, height: 18 }} />
            <span style={{ fontSize: 13, color: "var(--text-body)" }}>Active</span>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Button onClick={handleCreate} loading={addBrand.isPending}>
              Create brand &amp; reprocess email
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function DetailModal({
  id,
  onClose,
  onAnalyze,
  analyzing,
  onAddBrand,
  onIgnore,
}: {
  id: number;
  onClose: () => void;
  onAnalyze: () => void;
  analyzing: boolean;
  onAddBrand: () => void;
  onIgnore: () => void;
}) {
  const { data, isLoading } = useUnknownEmail(id);

  return (
    <Modal title={data ? data.subject : `Unknown email #${id}`} onClose={onClose}>
      {isLoading || !data ? (
        <div style={{ color: "var(--text-muted)" }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 13, color: "var(--text-body)" }}>
          <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-faint)" }}>
              General
            </div>
            <div><strong style={{ color: "var(--text-strong)" }}>Sender:</strong> {data.sender}</div>
            <div><strong style={{ color: "var(--text-strong)" }}>Domain:</strong> {data.sender_domain || "—"}</div>
            <div><strong style={{ color: "var(--text-strong)" }}>Received:</strong> {formatDateTime(data.received_date)}</div>
            <div>
              <strong style={{ color: "var(--text-strong)" }}>Status:</strong>{" "}
              <Badge tone={STATUS_TONE[data.status]}>{STATUS_LABEL[data.status]}</Badge>
            </div>
          </section>

          {data.suggestion && (
            <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-faint)" }}>
                AI Result
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {data.suggestion.logo_url && (
                  <img
                    src={data.suggestion.logo_url}
                    alt=""
                    style={{ width: 40, height: 40, borderRadius: 8, objectFit: "contain", background: "var(--surface-sunken)", border: "1px solid var(--border)" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text-strong)" }}>{data.suggestion.name ?? "Unidentified"}</div>
                  {data.suggestion.website && (
                    <a href={data.suggestion.website} target="_blank" rel="noreferrer" style={{ color: "var(--brand)", fontSize: 12 }}>
                      {data.suggestion.website}
                    </a>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5 }}>
                {data.suggestion.category && <span><strong style={{ color: "var(--text-strong)" }}>Category:</strong> {data.suggestion.category}</span>}
                {data.suggestion.country && <span><strong style={{ color: "var(--text-strong)" }}>Country:</strong> {data.suggestion.country}</span>}
                <span><strong style={{ color: "var(--text-strong)" }}>Confidence:</strong> <ConfidenceBar value={data.suggestion.confidence} /></span>
              </div>
              {data.suggestion.reasoning && (
                <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontStyle: "italic" }}>{data.suggestion.reasoning}</div>
              )}
            </section>
          )}

          {data.analysis_error && (
            <div
              style={{
                display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px",
                background: "var(--danger-subtle)", border: "1px solid var(--danger-subtle)",
                borderRadius: "var(--radius-sm)", color: "var(--danger)", fontSize: 12.5,
              }}
            >
              <Icon.alert size={14} style={{ flex: "0 0 auto", marginTop: 1 }} />
              <span>{data.analysis_error}</span>
            </div>
          )}

          <section>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 6 }}>
              Body
            </div>
            <pre
              style={{
                maxHeight: 260, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
                background: "var(--surface-sunken)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                padding: 12, fontSize: 12.5, fontFamily: "var(--font-mono)",
              }}
            >
              {data.body || "(no body)"}
            </pre>
          </section>

          {data.ocr_text_clean && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 6 }}>
                OCR text
              </div>
              <pre
                style={{
                  maxHeight: 200, overflowY: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
                  background: "var(--ai-subtle)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
                  padding: 12, fontSize: 12.5, fontFamily: "var(--font-mono)",
                }}
              >
                {data.ocr_text_clean}
              </pre>
            </section>
          )}

          {data.image_urls.length > 0 && (
            <section>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--text-faint)", marginBottom: 6 }}>
                Images ({data.image_urls.length})
              </div>
              <ImageGallery urls={data.image_urls} />
            </section>
          )}

          {data.status !== "ignored" && data.status !== "resolved" && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", paddingTop: 4, borderTop: "1px solid var(--border)" }}>
              <Button loading={analyzing} onClick={onAnalyze}>
                {data.status === "analyzed" ? "Re-analyze" : "Analyze with AI"}
              </Button>
              {data.status === "analyzed" && <Button variant="secondary" onClick={onAddBrand}>Add Brand</Button>}
              <Button variant="ghost" onClick={onIgnore}>Ignore</Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function TableSkeleton({ columns }: { columns: string }) {
  return (
    <div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid", gridTemplateColumns: columns, alignItems: "center", gap: 12,
            padding: "var(--row-pad) 20px", borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="skeleton-shimmer" style={{ height: 16, width: 16 }} />
          <div className="skeleton-shimmer" style={{ height: 12, width: "80%" }} />
          <div className="skeleton-shimmer" style={{ height: 12, width: "60%" }} />
          <div className="skeleton-shimmer" style={{ height: 12, width: "70%" }} />
          <div className="skeleton-shimmer" style={{ height: 12, width: "60%" }} />
          <div className="skeleton-shimmer" style={{ height: 20, width: 80, borderRadius: 999 }} />
          <div className="skeleton-shimmer" style={{ height: 20, width: 80, borderRadius: 999 }} />
          <div className="skeleton-shimmer" style={{ height: 28, width: "90%" }} />
        </div>
      ))}
    </div>
  );
}

const columns = "34px 190px 130px 1fr 110px 100px 100px 190px 220px";

export function UnknownEmailsManager() {
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get("q") ?? "");
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

  const statusFilter = (params.get("status") as UnknownEmailStatus | null) ?? undefined;
  const page = Number(params.get("page") ?? "1") || 1;
  const pageSize = (Number(params.get("page_size")) as (typeof PAGE_SIZES)[number]) || 25;

  function updateParams(next: Record<string, string | undefined>) {
    const p = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) p.set(key, value);
      else p.delete(key);
    }
    setParams(p, { replace: true });
  }

  useEffect(() => {
    if (debouncedSearch !== (params.get("q") ?? "")) {
      updateParams({ q: debouncedSearch || undefined, page: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const { data, isLoading, isFetching, isError } = useUnknownEmails({
    status: statusFilter,
    q: params.get("q") || undefined,
    page,
    page_size: pageSize,
  });

  const ignore = useIgnoreUnknownEmail();
  const del = useDeleteUnknownEmail();
  const bulkAction = useBulkUnknownEmailAction();
  const discoverJob = useDiscoverJobRunner();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [addBrandFor, setAddBrandFor] = useState<UnknownEmail | null>(null);

  if (isError) return <div style={{ color: "var(--danger)" }}>Failed to load unknown emails.</div>;

  const summary = data?.summary;
  const candidates = data?.candidates ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function toggleSelected(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((s) => (s.size === candidates.length ? new Set() : new Set(candidates.map((c) => c.id))));
  }

  const FILTERS: { value: UnknownEmailStatus | ""; label: string; count?: number }[] = [
    { value: "", label: "All", count: summary?.total },
    { value: "pending", label: "Pending", count: summary?.pending },
    { value: "analyzed", label: "AI Completed", count: summary?.analyzed },
    { value: "resolved", label: "Brand Added", count: summary?.resolved },
    { value: "ignored", label: "Ignored", count: summary?.ignored },
  ];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <StatCard icon={<Icon.inbox size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Total unknown" value={summary?.total ?? "—"} />
        <StatCard icon={<Icon.clock size={17} />} iconColor="var(--amber-600)" iconBg="var(--warning-subtle)" label="Pending" value={summary?.pending ?? "—"} valueColor="var(--warning)" />
        <StatCard icon={<Icon.sparkle size={17} />} iconColor="var(--ai)" iconBg="var(--ai-subtle)" label="AI completed" value={summary?.analyzed ?? "—"} valueColor="var(--ai)" />
        <StatCard icon={<Icon.check size={17} />} iconColor="var(--success)" iconBg="var(--success-subtle)" label="Brand added" value={summary?.resolved ?? "—"} valueColor="var(--success)" />
        <StatCard icon={<Icon.x size={17} />} iconColor="var(--text-muted)" iconBg="var(--surface-sunken)" label="Ignored" value={summary?.ignored ?? "—"} />
      </div>

      <Card>
        <CardHeader
          title="Search & filter"
          aside={
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Button size="sm" loading={discoverJob.starting} disabled={discoverJob.running} onClick={() => discoverJob.start()}>
                Analyze all pending
              </Button>
              {discoverJob.job && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {discoverJob.running
                    ? `Analyzing ${discoverJob.job.processed_items}/${discoverJob.job.total_items}…`
                    : discoverJob.job.status === "completed"
                      ? `Done — ${discoverJob.job.successful} identified, ${discoverJob.job.failed} failed.`
                      : ""}
                </span>
              )}
            </div>
          }
        />

        <div style={{ position: "relative" }}>
          <Icon.search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search subject, sender, email address, or domain…"
            aria-label="Search unknown emails"
            autoComplete="off"
            style={{
              width: 320, height: 44, padding: "0 36px 0 36px", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", background: "var(--surface-card)", color: "var(--text-strong)",
              fontSize: 13.5, boxSizing: "border-box",
            }}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              aria-label="Clear search"
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22,
                border: "none", borderRadius: "var(--radius-pill)", background: "transparent", color: "var(--text-faint)", cursor: "pointer",
              }}
            >
              <Icon.x size={13} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const active = statusFilter === f.value || (!statusFilter && f.value === "");
            return (
              <button
                key={f.value || "all"}
                type="button"
                onClick={() => updateParams({ status: f.value || undefined, page: undefined })}
                style={{
                  height: 32, padding: "0 12px", borderRadius: "var(--radius-pill)",
                  border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                  background: active ? "var(--brand-subtle)" : "var(--surface-app)",
                  color: active ? "var(--brand)" : "var(--text-body)",
                  font: "600 12.5px/1 var(--font-sans)", cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                {f.label}
                {f.count !== undefined && <span style={{ opacity: 0.7 }}> · {f.count}</span>}
              </button>
            );
          })}
        </div>

        {selected.size > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 12px", background: "var(--brand-subtle)", borderRadius: "var(--radius-sm)" }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--brand)" }}>{selected.size} selected</span>
            <Button
              size="sm"
              variant="secondary"
              loading={discoverJob.starting}
              disabled={discoverJob.running}
              onClick={() => discoverJob.start(Array.from(selected))}
            >
              Analyze selected
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={bulkAction.isPending}
              onClick={() => bulkAction.mutate({ action: "ignore", ids: Array.from(selected) }, { onSuccess: () => setSelected(new Set()) })}
            >
              Ignore selected
            </Button>
            <Button
              size="sm"
              variant="danger"
              loading={bulkAction.isPending}
              onClick={() => {
                if (window.confirm(`Delete ${selected.size} unknown email(s)? This can't be undone.`)) {
                  bulkAction.mutate({ action: "delete", ids: Array.from(selected) }, { onSuccess: () => setSelected(new Set()) });
                }
              }}
            >
              Delete selected
            </Button>
          </div>
        )}
      </Card>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto", maxHeight: "70vh", overflowY: "auto" }}>
          <div style={{ minWidth: 1400 }}>
            <div
              style={{
                display: "grid", gridTemplateColumns: columns, gap: 12, padding: "11px 20px",
                background: "var(--surface-sunken)", borderBottom: "1px solid var(--border)",
                fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase",
                color: "var(--text-muted)", position: "sticky", top: 0, zIndex: 1,
              }}
            >
              <input
                type="checkbox"
                checked={candidates.length > 0 && selected.size === candidates.length}
                onChange={toggleSelectAll}
                style={{ width: 15, height: 15 }}
              />
              <span>Sender</span>
              <span>Domain</span>
              <span>Subject</span>
              <span>Received</span>
              <span>Status</span>
              <span>AI Status</span>
              <span>Suggested brand</span>
              <span>Actions</span>
            </div>

            {isLoading ? (
              <TableSkeleton columns={columns} />
            ) : candidates.length === 0 ? (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>No unknown emails</div>
                <div style={{ fontSize: 12.5 }}>
                  {params.get("q") || statusFilter ? "Try clearing your search or filters." : "Every sales_offers email so far has matched a known brand."}
                </div>
              </div>
            ) : (
              candidates.map((c) => {
                const { name, email } = parseSender(c.sender);
                const ai = aiStatusFor(c);
                return (
                  <div
                    key={c.id}
                    style={{
                      display: "grid", gridTemplateColumns: columns, alignItems: "center", gap: 12,
                      padding: "var(--row-pad) 20px", borderBottom: "1px solid var(--border)",
                      fontSize: 12.5, opacity: isFetching ? 0.6 : 1, transition: "opacity 0.15s ease",
                    }}
                  >
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleSelected(c.id)} style={{ width: 15, height: 15 }} />
                    <span style={{ minWidth: 0 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: "var(--text-strong)" }}>{name}</div>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11, color: "var(--text-faint)" }}>{email}</div>
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11.5 }}>
                      {c.sender_domain || "—"}
                    </span>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-body)" }}>{c.subject}</span>
                    <span style={{ font: "500 11.5px/1 var(--font-mono)", color: "var(--text-muted)" }}>{formatDateTime(c.received_date)}</span>
                    <span><Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge></span>
                    <span><Badge tone={ai.tone}>{ai.label}</Badge></span>
                    <span style={{ minWidth: 0 }}>
                      {c.suggestion?.name ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: "var(--text-strong)" }}>{c.suggestion.name}</span>
                          <ConfidenceBar value={c.suggestion.confidence} />
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-faint)" }}>—</span>
                      )}
                    </span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <Button size="sm" variant="secondary" onClick={() => setViewingId(c.id)}>
                        View
                      </Button>
                      {c.status !== "resolved" && c.status !== "ignored" && (
                        <Button size="sm" variant="ghost" loading={discoverJob.starting} disabled={discoverJob.running} onClick={() => discoverJob.start([c.id])}>
                          {c.status === "analyzed" ? "Re-analyze" : "Analyze"}
                        </Button>
                      )}
                      {c.status === "analyzed" && (
                        <Button size="sm" variant="secondary" onClick={() => setAddBrandFor(c)}>
                          Add Brand
                        </Button>
                      )}
                      {c.status !== "resolved" && c.status !== "ignored" && (
                        <Button size="sm" variant="ghost" loading={ignore.isPending} onClick={() => ignore.mutate(c.id)}>
                          Ignore
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="danger"
                        loading={del.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete unknown email "${c.subject}"?`)) del.mutate(c.id);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
            <span>{total === 0 ? "0 results" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}</span>
            <Select value={pageSize} onChange={(e) => updateParams({ page_size: e.target.value, page: undefined })} style={{ height: 30, fontSize: 12 }}>
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </Select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>
              ← Prev
            </Button>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Page {page} of {totalPages}</span>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => updateParams({ page: String(page + 1) })}>
              Next →
            </Button>
          </div>
        </div>
      </Card>

      {viewingId !== null && (
        <DetailModal
          id={viewingId}
          onClose={() => setViewingId(null)}
          analyzing={discoverJob.starting || discoverJob.running}
          onAnalyze={() => discoverJob.start([viewingId])}
          onAddBrand={() => {
            const c = candidates.find((x) => x.id === viewingId);
            if (c) setAddBrandFor(c);
          }}
          onIgnore={() => {
            ignore.mutate(viewingId);
            setViewingId(null);
          }}
        />
      )}

      {addBrandFor && <AddBrandModal candidate={addBrandFor} onClose={() => setAddBrandFor(null)} />}
    </>
  );
}
