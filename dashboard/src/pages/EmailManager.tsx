import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router";

import { isJobActive, useActiveJob, useStartJob } from "../api/jobs";
import {
  useDeleteEmail,
  useEmail,
  useEmails,
  useProcessEmail,
  useVerifyAllEmails,
  useVerifyAllEmailsStatus,
  useVerifyEmail,
  type EmailSortField,
  type EmailSummary,
  type ProcessingStatus,
} from "../api/emails";
import { useBrands } from "../api/brands";
import { apiClient } from "../api/client";
import { getJobTypeConfig } from "../config/jobTypes";
import { TONE_BG, TONE_FG, toneForName } from "../lib/publicOffers";
import { Icon } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button, IconButton, IconLinkButton } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Select } from "../components/ui/Field";
import { IconMenuButton } from "../components/ui/Menu";
import { Modal } from "../components/ui/Modal";
import { StatCard } from "../components/ui/StatCard";
import { Tabs } from "../components/ui/Tabs";
import { toast } from "../store/toastStore";

const VERIFICATION_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  legitimate: "success",
  suspicious: "warning",
  spam: "danger",
};

const PROCESSING_TONE: Record<ProcessingStatus, "success" | "warning" | "danger"> = {
  processed: "success",
  unprocessed: "warning",
  failed: "danger",
};

const PROCESSING_LABEL: Record<ProcessingStatus, string> = {
  processed: "Processed",
  unprocessed: "Unprocessed",
  failed: "Failed",
};

const PAGE_SIZES = [10, 25, 50, 100] as const;
const SEARCH_DEBOUNCE_MS = 400;

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** "From" headers are usually `"Display Name" <addr@x.com>` — split that into
 * a name to show in bold and an address to show underneath, muted. Falls back
 * to using the raw string as the address when there's no display name. */
function parseSender(raw: string): { name: string | null; address: string } {
  const match = raw.match(/^"?([^"<]*?)"?\s*<([^>]+)>$/);
  if (match && match[1].trim()) return { name: match[1].trim(), address: match[2].trim() };
  if (match) return { name: null, address: match[2].trim() };
  return { name: null, address: raw };
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "var(--warning-subtle)", color: "inherit", borderRadius: 2, padding: "0 1px" }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/** Sender/brand avatar for the emails table — logo comes strictly from the
 * Brands table's `logo_url` (set by an admin, or by the AI brand-discovery
 * flow), never guessed from a favicon service. Falls back to a colored
 * initials circle when the brand has no logo on file, or the email isn't
 * linked to a known brand yet. */
function EmailAvatar({ brandName, logoUrl, fallbackName, size = 36 }: { brandName: string | null; logoUrl: string | null; fallbackName: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const name = brandName || fallbackName;
  const tone = toneForName(name);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  if (logoUrl && !failed) {
    return (
      <img
        src={logoUrl}
        alt={name}
        onError={() => setFailed(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "contain",
          background: "var(--surface-card)",
          border: "1px solid var(--border)",
          flex: "0 0 auto",
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: TONE_BG[tone],
        color: TONE_FG[tone],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        font: `800 ${Math.max(12, size * 0.36)}px/1 var(--font-sans)`,
        flex: "0 0 auto",
      }}
      aria-hidden
    >
      {initials || "?"}
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

function ImagesModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useEmail(id);

  return (
    <Modal title={data ? `Images — #${data.id} ${data.subject}` : `Email #${id}`} onClose={onClose}>
      {isLoading || !data ? (
        <div style={{ color: "var(--text-muted)" }}>Loading…</div>
      ) : data.image_urls.length === 0 ? (
        <div style={{ color: "var(--text-muted)" }}>No images found in this email.</div>
      ) : (
        <ImageGallery urls={data.image_urls} size={140} />
      )}
    </Modal>
  );
}

function EmailDetailModal({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, isLoading } = useEmail(id);

  return (
    <Modal title={data ? `#${data.id} — ${data.subject}` : `Email #${id}`} onClose={onClose}>
      {isLoading || !data ? (
        <div style={{ color: "var(--text-muted)" }}>Loading…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 13, color: "var(--text-body)" }}>
          <div><strong style={{ color: "var(--text-strong)" }}>Sender:</strong> {data.sender}</div>
          {data.brand && <div><strong style={{ color: "var(--text-strong)" }}>Brand:</strong> {data.brand}</div>}
          <div><strong style={{ color: "var(--text-strong)" }}>Received:</strong> {formatDateTime(data.received_date)}</div>
          <div><strong style={{ color: "var(--text-strong)" }}>Created:</strong> {formatDateTime(data.processed_at)}</div>
          <div><strong style={{ color: "var(--text-strong)" }}>Offers extracted:</strong> {data.offers_count}</div>
          <div>
            <strong style={{ color: "var(--text-strong)" }}>Processing:</strong>{" "}
            <Badge tone={PROCESSING_TONE[data.processing_status]}>{PROCESSING_LABEL[data.processing_status]}</Badge>
            {data.processing_error && (
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "8px 10px",
                  background: "var(--danger-subtle)",
                  border: "1px solid var(--danger-subtle)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--danger)",
                  fontSize: 12.5,
                }}
              >
                <Icon.alert size={14} style={{ flex: "0 0 auto", marginTop: 1 }} />
                <span>{data.processing_error}</span>
              </div>
            )}
            {data.processing_attempted_at && (
              <div style={{ marginTop: 2, color: "var(--text-faint)", fontSize: 11.5 }}>
                Last attempt: {formatDateTime(data.processing_attempted_at)}
              </div>
            )}
          </div>
          {data.status ? (
            <div>
              <strong style={{ color: "var(--text-strong)" }}>Verification:</strong>{" "}
              <Badge tone={VERIFICATION_TONE[data.status] ?? "neutral"}>{data.status}</Badge>
              {data.note && <div style={{ marginTop: 4 }}>{data.note}</div>}
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)" }}>Not verified yet.</div>
          )}
          {data.gmail_link && (
            <div>
              <a href={data.gmail_link} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>
                Open in Gmail →
              </a>
            </div>
          )}
          {data.image_urls.length > 0 && (
            <div>
              <strong style={{ color: "var(--text-strong)" }}>Images ({data.image_urls.length}):</strong>
              <div style={{ marginTop: 6 }}>
                <ImageGallery urls={data.image_urls} />
              </div>
            </div>
          )}
          <div>
            <strong style={{ color: "var(--text-strong)" }}>Body:</strong>
            <pre
              style={{
                marginTop: 6,
                maxHeight: 320,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                background: "var(--surface-sunken)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: 12,
                fontSize: 12.5,
                fontFamily: "var(--font-mono)",
              }}
            >
              {data.body || "(no body)"}
            </pre>
          </div>
          {data.ocr_text_clean && (
            <div>
              <strong style={{ color: "var(--text-strong)" }}>
                OCR text (from images/GIFs){data.ocr_processed_at && <span style={{ fontWeight: 400, color: "var(--text-faint)", fontSize: 11 }}> — extracted {formatDateTime(data.ocr_processed_at)}</span>}:
              </strong>
              <pre
                style={{
                  marginTop: 6,
                  maxHeight: 220,
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  background: "var(--ai-subtle)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-sm)",
                  padding: 12,
                  fontSize: 12.5,
                  fontFamily: "var(--font-mono)",
                }}
              >
                {data.ocr_text_clean}
              </pre>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

/** The hero banner's arrow and the toolbar's "+ Add Email / Connect" button
 * both kick off the same email_sync background job the sidebar's "Run fetch"
 * button uses — this just gives it two more entry points, matching the new
 * design without inventing a second, fake "connect" feature. */
function useSyncEmails() {
  const startJob = useStartJob("email_sync");
  const active = useActiveJob("email_sync");
  const running = startJob.isPending || isJobActive(active.data?.status);
  return {
    running,
    run: () => {
      if (running) return;
      startJob.mutate(undefined, {
        onSuccess: () => toast.info(`${getJobTypeConfig("email_sync").title} started — new emails will appear shortly.`),
      });
    },
  };
}

function EmailManagerHero({ onSync, syncing }: { onSync: () => void; syncing: boolean }) {
  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "stretch" }}>
      <div style={{ flex: "1 1 320px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "var(--ls-wide)", textTransform: "uppercase", color: "var(--brand)", marginBottom: 6 }}>
          Email Manager
        </div>
        <h1 style={{ margin: "0 0 8px", font: "var(--fw-extra) 26px/1.25 var(--font-sans)", color: "var(--text-strong)" }}>
          Find &amp; Manage Brand Emails
        </h1>
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 520 }}>
          Discover the latest offers, promotions and brand communications from your favorite brands. Use AI to analyze and
          organize them efficiently.
        </p>
      </div>

      <button
        type="button"
        onClick={onSync}
        disabled={syncing}
        style={{
          flex: "1 1 320px",
          maxWidth: 420,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: 20,
          border: "1px solid var(--brand-subtle)",
          borderRadius: "var(--radius-lg)",
          background: "linear-gradient(135deg, var(--brand-subtle), var(--surface-card) 75%)",
          textAlign: "left",
          cursor: syncing ? "not-allowed" : "pointer",
          opacity: syncing ? 0.75 : 1,
        }}
      >
        <div
          style={{
            flex: "0 0 auto",
            width: 44,
            height: 44,
            borderRadius: "var(--radius-md)",
            background: "var(--brand)",
            color: "var(--on-brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon.mail size={20} />
        </div>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{ font: "var(--fw-semibold) 14px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>
            Smart Email Processing
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {syncing
              ? "Fetching & analysing new emails…"
              : "Let AI find the best offers, extract key details and save you hours of manual work."}
          </div>
        </div>
        <Icon.arrowRight size={18} style={{ flex: "0 0 auto", color: "var(--brand)" }} />
      </button>
    </div>
  );
}

/** Every per-row action collapsed to three circular icons — view, open in
 * Gmail, and a "…" menu for the rest (process/reprocess, images, AI verify,
 * delete) — so the Actions column stays compact no matter how many actions
 * a row can have. */
function EmailRowActions({
  email,
  onView,
  onViewOffers,
  onViewImages,
}: {
  email: EmailSummary;
  onView: () => void;
  onViewOffers: () => void;
  onViewImages: () => void;
}) {
  const process = useProcessEmail();
  const verify = useVerifyEmail();
  const deleteEmail = useDeleteEmail();
  const isRetry = email.processing_status !== "unprocessed";

  return (
    <div style={{ display: "flex", gap: 4 }}>
      <IconButton icon={<Icon.eye size={14} />} label="View details" circle onClick={onView} />
      <IconLinkButton
        icon={<Icon.mail size={14} />}
        label={email.gmail_link ? "Open in Gmail" : "No Gmail message ID stored for this email"}
        href={email.gmail_link ?? undefined}
        target="_blank"
        rel="noreferrer"
        disabled={!email.gmail_link}
        circle
      />
      <IconMenuButton
        icon={<Icon.list size={14} />}
        label="More actions"
        circle
        items={[
          ...(email.offers_count > 0
            ? [{ label: "View offers", icon: <Icon.offer size={14} />, onClick: onViewOffers }]
            : []),
          {
            label: isRetry ? "Reprocess" : "Process",
            icon: <Icon.retry size={14} />,
            onClick: () => process.mutate(email.id),
            disabled: process.isPending,
          },
          ...(email.image_count > 0
            ? [{ label: `View ${email.image_count} image(s)`, icon: <Icon.image size={14} />, onClick: onViewImages }]
            : []),
          {
            label: "Verify with AI",
            icon: <Icon.sparkle size={14} />,
            onClick: () => verify.mutate(email.id),
            disabled: verify.isPending,
          },
          {
            label: "Delete",
            icon: <Icon.trash size={14} />,
            tone: "danger",
            onClick: () => {
              if (window.confirm(`Delete email #${email.id} and its extracted offers?`)) deleteEmail.mutate(email.id);
            },
          },
        ]}
      />
    </div>
  );
}

const columns = "28px 220px 1fr 140px 120px 70px 110px";

function TableSkeleton() {
  return (
    <div>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: columns,
            alignItems: "center",
            gap: 12,
            padding: "var(--row-pad) 20px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="skeleton-shimmer" style={{ height: 14, width: 14 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="skeleton-shimmer" style={{ height: 36, width: 36, borderRadius: 10 }} />
            <div className="skeleton-shimmer" style={{ height: 12, width: "70%" }} />
          </div>
          <div className="skeleton-shimmer" style={{ height: 12, width: "60%" }} />
          <div className="skeleton-shimmer" style={{ height: 12, width: "70%" }} />
          <div className="skeleton-shimmer" style={{ height: 20, width: 80, borderRadius: 999 }} />
          <div className="skeleton-shimmer" style={{ height: 12, width: 24 }} />
          <div className="skeleton-shimmer" style={{ height: 28, width: "90%" }} />
        </div>
      ))}
    </div>
  );
}

function SortableHeader({
  label,
  field,
  sort,
  sortDir,
  onSort,
}: {
  label: string;
  field: EmailSortField;
  sort: EmailSortField;
  sortDir: "asc" | "desc";
  onSort: (field: EmailSortField) => void;
}) {
  const active = sort === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        border: "none",
        background: "transparent",
        padding: 0,
        font: "inherit",
        color: active ? "var(--text-strong)" : "inherit",
        cursor: "pointer",
      }}
    >
      {label}
      {active && <Icon.chevron size={11} style={{ transform: sortDir === "asc" ? "rotate(-90deg)" : "rotate(90deg)" }} />}
    </button>
  );
}

const SORT_OPTIONS: { value: string; label: string; sort: EmailSortField; sort_dir: "asc" | "desc" }[] = [
  { value: "newest", label: "Newest", sort: "received_date", sort_dir: "desc" },
  { value: "oldest", label: "Oldest", sort: "received_date", sort_dir: "asc" },
  { value: "sender", label: "Sender A–Z", sort: "sender", sort_dir: "asc" },
  { value: "subject", label: "Subject A–Z", sort: "subject", sort_dir: "asc" },
];

/** Numbered page list with an ellipsis for large page counts — always shows
 * the first and last page, plus a window of pages around the current one. */
function pageNumbers(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}

export function EmailManager() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get("q") ?? "");
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

  const verificationFilter = params.get("status") ?? "";
  const processingFilter = (params.get("processing_status") as ProcessingStatus | null) ?? undefined;
  const brandFilter = params.get("brand") ?? "";
  const page = Number(params.get("page") ?? "1") || 1;
  const pageSize = (Number(params.get("page_size")) as (typeof PAGE_SIZES)[number]) || 25;
  const sort = (params.get("sort") as EmailSortField | null) ?? "received_date";
  const sortDir = (params.get("sort_dir") as "asc" | "desc" | null) ?? "desc";
  const sortValue = SORT_OPTIONS.find((o) => o.sort === sort && o.sort_dir === sortDir)?.value ?? "newest";

  function updateParams(next: Record<string, string | undefined>) {
    const p = new URLSearchParams(params);
    for (const [key, value] of Object.entries(next)) {
      if (value) p.set(key, value);
      else p.delete(key);
    }
    setParams(p, { replace: true });
  }

  // debounced search -> URL (and reset to page 1 on a new query)
  useEffect(() => {
    if (debouncedSearch !== (params.get("q") ?? "")) {
      updateParams({ q: debouncedSearch || undefined, page: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch]);

  const activeJob = useActiveJob("email_sync");
  const { data, isLoading, isFetching, isError } = useEmails(
    {
      status: verificationFilter || undefined,
      processing_status: processingFilter,
      brand: brandFilter || undefined,
      q: params.get("q") || undefined,
      page,
      page_size: pageSize,
      sort,
      sort_dir: sortDir,
    },
    { liveWhileJobActive: isJobActive(activeJob.data?.status) },
  );
  const { data: brandsData } = useBrands();
  const verifyAll = useVerifyAllEmails();
  const verifyAllStatus = useVerifyAllEmailsStatus(verifyAll.isPending || (verifyAll.isSuccess && !!data));
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [viewingImagesId, setViewingImagesId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);
  const sync = useSyncEmails();

  function toggleSelected(id: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} selected email(s) and their extracted offers?`)) return;
    setBulkRunning(true);
    const results = await Promise.allSettled(ids.map((id) => apiClient.delete(`/emails/${id}`)));
    setBulkRunning(false);
    const failed = results.filter((r) => r.status === "rejected").length;
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    if (failed === 0) toast.success(`${ids.length} email(s) deleted.`);
    else toast.error(`Deleted ${ids.length - failed} email(s), ${failed} failed.`);
    setSelected(new Set());
  }

  async function bulkReprocess() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkRunning(true);
    const results = await Promise.allSettled(ids.map((id) => apiClient.post(`/emails/${id}/process`)));
    setBulkRunning(false);
    const failed = results.filter((r) => r.status === "rejected").length;
    queryClient.invalidateQueries({ queryKey: ["emails"] });
    queryClient.invalidateQueries({ queryKey: ["offers"] });
    if (failed === 0) toast.success(`${ids.length} email(s) reprocessed.`);
    else toast.error(`Reprocessed ${ids.length - failed} email(s), ${failed} failed.`);
    setSelected(new Set());
  }

  if (isError) return <div style={{ color: "var(--danger)" }}>Failed to load emails.</div>;

  const summary = data?.summary;
  const emails = data?.emails ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const running = verifyAllStatus.data?.running ?? false;
  const activeQuery = params.get("q") ?? "";
  const hasFilters = !!(activeQuery || processingFilter || verificationFilter || brandFilter);

  function toggleSort(field: EmailSortField) {
    if (sort === field) {
      updateParams({ sort_dir: sortDir === "asc" ? "desc" : "asc" });
    } else {
      updateParams({ sort: field, sort_dir: "desc" });
    }
  }

  function clearFilters() {
    setSearchInput("");
    updateParams({ q: undefined, status: undefined, processing_status: undefined, brand: undefined, page: undefined });
  }

  return (
    <>
      <EmailManagerHero onSync={sync.run} syncing={sync.running} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <StatCard icon={<Icon.mail size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Total emails" value={summary?.total ?? "—"} />
        <StatCard icon={<Icon.check size={17} />} iconColor="var(--success)" iconBg="var(--success-subtle)" label="Processed" value={summary?.processed ?? "—"} valueColor="var(--success)" />
        <StatCard icon={<Icon.clock size={17} />} iconColor="var(--amber-600)" iconBg="var(--warning-subtle)" label="Unprocessed" value={summary?.unprocessed ?? "—"} valueColor="var(--warning)" />
        <StatCard icon={<Icon.x size={17} />} iconColor="var(--danger)" iconBg="var(--danger-subtle)" label="Failed" value={summary?.failed ?? "—"} valueColor="var(--danger)" />
        <StatCard icon={<Icon.sparkle size={17} />} iconColor="var(--ai)" iconBg="var(--ai-subtle)" label="Offers found" value={summary?.offers_found ?? "—"} />
      </div>

      <Tabs
        tabs={[
          { id: "", label: "All Emails" },
          { id: "processed", label: "Processed" },
          { id: "unprocessed", label: "Unprocessed" },
          { id: "failed", label: "Failed" },
        ]}
        active={processingFilter ?? ""}
        onChange={(id) => updateParams({ processing_status: id || undefined, page: undefined })}
      />

      <Card>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 260px", minWidth: 220 }}>
            <Icon.search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by brand, subject, or sender…"
              aria-label="Search emails"
              id="dashboard-search-box"
              name="dashboard-search-box"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              data-bwignore
              data-form-type="other"
              style={{
                width: "100%",
                height: 42,
                padding: "0 36px 0 36px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                background: "var(--surface-card)",
                color: "var(--text-strong)",
                fontSize: 13.5,
                boxSizing: "border-box",
              }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                aria-label="Clear search"
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  border: "none",
                  borderRadius: "var(--radius-pill)",
                  background: "transparent",
                  color: "var(--text-faint)",
                  cursor: "pointer",
                }}
              >
                <Icon.x size={13} />
              </button>
            )}
          </div>

          <Select
            aria-label="Filter by brand"
            value={brandFilter}
            onChange={(e) => updateParams({ brand: e.target.value || undefined, page: undefined })}
            style={{ width: 160 }}
          >
            <option value="">All Brands</option>
            {(brandsData?.brands ?? []).map((b) => (
              <option key={b.id} value={b.name}>
                {b.name}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Filter by verification status"
            value={verificationFilter}
            onChange={(e) => updateParams({ status: e.target.value || undefined, page: undefined })}
            style={{ width: 150 }}
          >
            <option value="">All Status</option>
            <option value="unverified">Unverified</option>
            <option value="legitimate">Legitimate</option>
            <option value="suspicious">Suspicious</option>
            <option value="spam">Spam</option>
          </Select>

          <Select
            aria-label="Sort by"
            value={sortValue}
            onChange={(e) => {
              const opt = SORT_OPTIONS.find((o) => o.value === e.target.value);
              if (opt) updateParams({ sort: opt.sort, sort_dir: opt.sort_dir });
            }}
            style={{ width: 150 }}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Sort by: {o.label}
              </option>
            ))}
          </Select>

          <IconButton icon={<Icon.filter size={14} />} label="Clear all filters" variant="secondary" disabled={!hasFilters} onClick={clearFilters} />

          <div style={{ flex: "1 1 auto" }} />

          <Button onClick={sync.run} loading={sync.running} disabled={sync.running}>
            <Icon.mail size={14} /> Add Email / Connect
          </Button>
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Button size="sm" loading={verifyAll.isPending || running} disabled={verifyAll.isPending || running} onClick={() => verifyAll.mutate(undefined)}>
            Verify all unverified
          </Button>
          <Button
            size="sm"
            variant="secondary"
            loading={verifyAll.isPending || running}
            disabled={verifyAll.isPending || running}
            onClick={() => verifyAll.mutate(["suspicious", "spam"])}
          >
            Re-verify suspicious/spam
          </Button>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {running
              ? `Verifying ${verifyAllStatus.data?.done}/${verifyAllStatus.data?.total}…`
              : `${summary?.unverified ?? 0} unverified · ${summary?.suspicious ?? 0} suspicious · ${summary?.spam ?? 0} spam`}
          </span>
        </div>
      </Card>

      {selected.size > 0 && (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)" }}>{selected.size} selected</span>
            <Button size="sm" loading={bulkRunning} disabled={bulkRunning} onClick={bulkReprocess}>
              Reprocess selected
            </Button>
            <Button size="sm" variant="danger" loading={bulkRunning} disabled={bulkRunning} onClick={bulkDelete}>
              Delete selected
            </Button>
            <Button size="sm" variant="ghost" disabled={bulkRunning} onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
          </div>
        </Card>
      )}

      <Card padded={false} style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto", maxHeight: "70vh", overflowY: "auto" }}>
          <div style={{ minWidth: 1000 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: columns,
                gap: 12,
                padding: "11px 20px",
                background: "var(--surface-sunken)",
                borderBottom: "1px solid var(--border)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "var(--ls-wide)",
                textTransform: "uppercase",
                color: "var(--text-muted)",
                position: "sticky",
                top: 0,
                zIndex: 1,
              }}
            >
              <input
                type="checkbox"
                aria-label="Select all loaded emails"
                checked={emails.length > 0 && emails.every((e) => selected.has(e.id))}
                onChange={(e) => {
                  if (e.target.checked) setSelected(new Set(emails.map((em) => em.id)));
                  else setSelected(new Set());
                }}
                style={{ width: 14, height: 14 }}
              />
              <span><SortableHeader label="Sender" field="sender" sort={sort} sortDir={sortDir} onSort={toggleSort} /></span>
              <span><SortableHeader label="Subject / Brand" field="subject" sort={sort} sortDir={sortDir} onSort={toggleSort} /></span>
              <span><SortableHeader label="Received" field="received_date" sort={sort} sortDir={sortDir} onSort={toggleSort} /></span>
              <span><SortableHeader label="Status" field="processing_status" sort={sort} sortDir={sortDir} onSort={toggleSort} /></span>
              <span>Offers</span>
              <span>Actions</span>
            </div>

            {isLoading ? (
              <TableSkeleton />
            ) : emails.length === 0 ? (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-muted)" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-strong)", marginBottom: 4 }}>No emails found</div>
                <div style={{ fontSize: 12.5 }}>
                  {hasFilters ? "Try clearing your search or filters." : "Use “Add Email / Connect” above to pull in new emails."}
                </div>
              </div>
            ) : (
              emails.map((email) => {
                const parsed = parseSender(email.sender);
                return (
                  <div
                    key={email.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: columns,
                      alignItems: "center",
                      gap: 12,
                      padding: "var(--row-pad) 20px",
                      borderBottom: "1px solid var(--border)",
                      fontSize: 12.5,
                      opacity: isFetching ? 0.6 : 1,
                      transition: "opacity 0.15s ease",
                    }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select email #${email.id}`}
                      checked={selected.has(email.id)}
                      onChange={() => toggleSelected(email.id)}
                      style={{ width: 14, height: 14 }}
                    />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      <EmailAvatar
                        brandName={email.brand}
                        logoUrl={(email.brand && brandsData?.brands.find((b) => b.name === email.brand)?.logo_url) || null}
                        fallbackName={parsed.name || parsed.address}
                        size={36}
                      />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: "var(--text-strong)" }}>
                          <Highlight text={parsed.name ?? parsed.address} query={activeQuery} />
                        </div>
                        <div style={{ fontSize: 11, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {parsed.address}
                        </div>
                      </div>
                    </div>
                    <span style={{ minWidth: 0 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: "var(--text-strong)" }}>
                        <Highlight text={email.subject} query={activeQuery} />
                      </div>
                      {email.brand && (
                        <div style={{ fontSize: 11, color: "var(--text-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <Highlight text={email.brand} query={activeQuery} />
                        </div>
                      )}
                    </span>
                    <span style={{ font: "500 12px/1 var(--font-mono)", color: "var(--text-muted)" }}>{formatDateTime(email.received_date)}</span>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
                      <Badge tone={PROCESSING_TONE[email.processing_status]}>{PROCESSING_LABEL[email.processing_status]}</Badge>
                      {email.processing_status === "failed" && email.processing_error && (
                        <span title={email.processing_error} style={{ display: "inline-flex", color: "var(--danger)", cursor: "help" }}>
                          <Icon.alert size={14} />
                        </span>
                      )}
                    </div>
                    <span style={{ font: "600 12px/1 var(--font-mono)" }}>{email.offers_count}</span>
                    <EmailRowActions
                      email={email}
                      onView={() => setViewingId(email.id)}
                      onViewOffers={() => navigate(`/offers?email_id=${email.id}`)}
                      onViewImages={() => setViewingImagesId(email.id)}
                    />
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
            <span>
              {total === 0 ? "0 results" : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} emails`}
            </span>
            <Select
              value={pageSize}
              onChange={(e) => updateParams({ page_size: e.target.value, page: undefined })}
              style={{ height: 30, fontSize: 12 }}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
            </Select>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <IconButton
              icon={<Icon.chevron size={13} style={{ transform: "rotate(90deg)" }} />}
              label="Previous page"
              variant="secondary"
              disabled={page <= 1}
              onClick={() => updateParams({ page: String(page - 1) })}
            />
            {pageNumbers(page, totalPages).map((p, i) =>
              p === "…" ? (
                <span key={`ellipsis-${i}`} style={{ padding: "0 4px", color: "var(--text-faint)", fontSize: 12.5 }}>
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => updateParams({ page: String(p) })}
                  aria-current={p === page ? "page" : undefined}
                  style={{
                    minWidth: 30,
                    height: 30,
                    padding: "0 6px",
                    border: "1px solid transparent",
                    borderRadius: "var(--radius-sm)",
                    background: p === page ? "var(--brand)" : "transparent",
                    color: p === page ? "var(--on-brand)" : "var(--text-body)",
                    font: "600 12.5px/1 var(--font-mono)",
                    cursor: "pointer",
                  }}
                >
                  {p}
                </button>
              ),
            )}
            <IconButton
              icon={<Icon.chevron size={13} style={{ transform: "rotate(-90deg)" }} />}
              label="Next page"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => updateParams({ page: String(page + 1) })}
            />
          </div>
        </div>
      </Card>

      {viewingId !== null && <EmailDetailModal id={viewingId} onClose={() => setViewingId(null)} />}
      {viewingImagesId !== null && <ImagesModal id={viewingImagesId} onClose={() => setViewingImagesId(null)} />}
    </>
  );
}
