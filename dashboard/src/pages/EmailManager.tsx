import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";

import { isJobActive, useActiveJob, useJob, useStartJob } from "../api/jobs";
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
import { getJobTypeConfig } from "../config/jobTypes";
import { Icon } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Label, Select } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { StatCard } from "../components/ui/StatCard";

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

function rowAccentStyle(status: ProcessingStatus): React.CSSProperties {
  if (status === "failed") return { borderLeft: "3px solid var(--danger)", background: "var(--danger-subtle)" };
  if (status === "unprocessed") return { borderLeft: "3px solid var(--warning)", background: "var(--warning-subtle)" };
  return { borderLeft: "3px solid transparent" };
}

function VerifyButton({ emailId }: { emailId: number }) {
  const verify = useVerifyEmail();
  return (
    <Button size="sm" variant="ghost" loading={verify.isPending} onClick={() => verify.mutate(emailId)}>
      {verify.isPending ? "Verifying" : "Verify AI"}
    </Button>
  );
}

function ProcessButton({ email }: { email: EmailSummary }) {
  const process = useProcessEmail();
  const isRetry = email.processing_status !== "unprocessed";
  return (
    <Button size="sm" variant={isRetry ? "ghost" : "secondary"} loading={process.isPending} onClick={() => process.mutate(email.id)}>
      {process.isPending ? "Processing" : isRetry ? "Reprocess" : "Process"}
    </Button>
  );
}

function OpenInGmailButton({ email }: { email: EmailSummary }) {
  if (!email.gmail_link) {
    return (
      <span title="No Gmail message ID stored for this email — can't open it in Gmail.">
        <Button size="sm" variant="ghost" disabled>
          <Icon.mail size={13} /> Gmail
        </Button>
      </span>
    );
  }
  return (
    <a href={email.gmail_link} target="_blank" rel="noreferrer">
      <Button size="sm" variant="ghost">
        <Icon.mail size={13} /> Gmail
      </Button>
    </a>
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

/** Lightweight "start + one-line status" trigger — full live progress, logs,
 * and history now live on the Pipeline Center (/pipeline), which every
 * trigger here links to instead of duplicating the monitoring UI inline. */
function PipelineTrigger({ jobType, label, invalidateEmailsOnFinish }: { jobType: string; label: string; invalidateEmailsOnFinish?: boolean }) {
  const queryClient = useQueryClient();
  const startJob = useStartJob(jobType);
  const active = useActiveJob(jobType);
  const [visibleJobId, setVisibleJobId] = useState<number | null>(null);

  useEffect(() => {
    if (active.data && visibleJobId === null) setVisibleJobId(active.data.id);
  }, [active.data, visibleJobId]);

  const watched = useJob(visibleJobId);
  const running = isJobActive(watched.data?.status);

  const wasActive = useRef(false);
  useEffect(() => {
    if (wasActive.current && !running && invalidateEmailsOnFinish) {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    }
    wasActive.current = running;
  }, [running, queryClient, invalidateEmailsOnFinish]);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <Button
        loading={startJob.isPending}
        disabled={running}
        onClick={() => startJob.mutate(undefined, { onSuccess: (data) => setVisibleJobId(data.jobId) })}
      >
        {label}
      </Button>
      {watched.data && (
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {watched.data.status === "cancelling"
            ? "Finishing current item before stopping… "
            : running
              ? `Running ${watched.data.processed_items}/${watched.data.total_items}… `
              : watched.data.status === "completed"
                ? `Done — ${watched.data.successful} succeeded, ${watched.data.failed} failed. `
                : watched.data.status === "failed"
                  ? `Failed. `
                  : watched.data.status === "cancelled"
                    ? "Cancelled. "
                    : ""}
          <Link to="/pipeline" style={{ color: "var(--brand)" }}>
            View in Pipeline Center →
          </Link>
        </span>
      )}
    </div>
  );
}

function PipelineActions() {
  return (
    <Card>
      <CardHeader title="Pipeline actions" aside={<Link to="/pipeline" style={{ fontSize: 12.5, color: "var(--brand)" }}>Open Pipeline Center →</Link>} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <PipelineTrigger jobType="email_sync" label={getJobTypeConfig("email_sync").title} invalidateEmailsOnFinish />
        <PipelineTrigger jobType="process_pending" label={getJobTypeConfig("process_pending").title} invalidateEmailsOnFinish />
        <PipelineTrigger jobType="verify_offers" label={getJobTypeConfig("verify_offers").title} />
      </div>
    </Card>
  );
}

const columns = "56px 190px 1fr 130px 130px 90px 300px";

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
          <div className="skeleton-shimmer" style={{ height: 12, width: 24 }} />
          <div className="skeleton-shimmer" style={{ height: 12, width: "80%" }} />
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

export function EmailManager() {
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(params.get("q") ?? "");
  const debouncedSearch = useDebouncedValue(searchInput, SEARCH_DEBOUNCE_MS);

  const verificationFilter = params.get("status") ?? "";
  const processingFilter = (params.get("processing_status") as ProcessingStatus | null) ?? undefined;
  const page = Number(params.get("page") ?? "1") || 1;
  const pageSize = (Number(params.get("page_size")) as (typeof PAGE_SIZES)[number]) || 25;
  const sort = (params.get("sort") as EmailSortField | null) ?? "received_date";
  const sortDir = (params.get("sort_dir") as "asc" | "desc" | null) ?? "desc";

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
      q: params.get("q") || undefined,
      page,
      page_size: pageSize,
      sort,
      sort_dir: sortDir,
    },
    { liveWhileJobActive: isJobActive(activeJob.data?.status) },
  );
  const deleteEmail = useDeleteEmail();
  const verifyAll = useVerifyAllEmails();
  const verifyAllStatus = useVerifyAllEmailsStatus(verifyAll.isPending || (verifyAll.isSuccess && !!data));
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [viewingImagesId, setViewingImagesId] = useState<number | null>(null);

  if (isError) return <div style={{ color: "var(--danger)" }}>Failed to load emails.</div>;

  const summary = data?.summary;
  const emails = data?.emails ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const running = verifyAllStatus.data?.running ?? false;
  const activeQuery = params.get("q") ?? "";

  function toggleSort(field: EmailSortField) {
    if (sort === field) {
      updateParams({ sort_dir: sortDir === "asc" ? "desc" : "asc" });
    } else {
      updateParams({ sort: field, sort_dir: "desc" });
    }
  }

  const PROCESSING_FILTERS: { value: ProcessingStatus | ""; label: string; count?: number }[] = [
    { value: "", label: "All", count: summary?.total },
    { value: "processed", label: "Processed", count: summary?.processed },
    { value: "unprocessed", label: "Unprocessed", count: summary?.unprocessed },
    { value: "failed", label: "Failed", count: summary?.failed },
  ];

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <StatCard icon={<Icon.offer size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Total emails" value={summary?.total ?? "—"} />
        <StatCard icon={<Icon.check size={17} />} iconColor="var(--success)" iconBg="var(--success-subtle)" label="Processed" value={summary?.processed ?? "—"} valueColor="var(--success)" />
        <StatCard icon={<Icon.clock size={17} />} iconColor="var(--amber-600)" iconBg="var(--warning-subtle)" label="Unprocessed" value={summary?.unprocessed ?? "—"} valueColor="var(--warning)" />
        <StatCard icon={<Icon.x size={17} />} iconColor="var(--danger)" iconBg="var(--danger-subtle)" label="Failed" value={summary?.failed ?? "—"} valueColor="var(--danger)" />
        <StatCard icon={<Icon.mail size={17} />} iconColor="var(--text-muted)" iconBg="var(--surface-sunken)" label="Unverified" value={summary?.unverified ?? "—"} />
      </div>

      <PipelineActions />

      <Card>
        <CardHeader title="Search & filter" />

        <div style={{ position: "relative" }}>
          <Icon.search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search subject, sender, brand, Gmail message ID, or body…"
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
              width: 300,
              height: 44,
              padding: "0 36px 0 36px",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              background: "var(--surface-card)",
              color: "var(--text-strong)",
              fontSize: 13.5,
              boxSizing: "border-box",
            }}
            // className="search-input-clean"
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

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PROCESSING_FILTERS.map((f) => {
            const active = processingFilter === f.value || (!processingFilter && f.value === "");
            return (
              <button
                key={f.value || "all"}
                type="button"
                onClick={() => updateParams({ processing_status: f.value || undefined, page: undefined })}
                style={{
                  height: 32,
                  padding: "0 12px",
                  borderRadius: "var(--radius-pill)",
                  border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                  background: active ? "var(--brand-subtle)" : "var(--surface-app)",
                  color: active ? "var(--brand)" : "var(--text-body)",
                  font: "600 12.5px/1 var(--font-sans)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {f.label}
                {f.count !== undefined && <span style={{ opacity: 0.7 }}> · {f.count}</span>}
              </button>
            );
          })}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <div>
            <Label>Verification status</Label>
            <Select value={verificationFilter} onChange={(e) => updateParams({ status: e.target.value || undefined, page: undefined })}>
              <option value="">All</option>
              <option value="unverified">Unverified</option>
              <option value="legitimate">Legitimate</option>
              <option value="suspicious">Suspicious</option>
              <option value="spam">Spam</option>
            </Select>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <Button loading={verifyAll.isPending || running} onClick={() => verifyAll.mutate()}>
            Verify all unverified
          </Button>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {running
              ? `Verifying ${verifyAllStatus.data?.done}/${verifyAllStatus.data?.total}…`
              : `${summary?.unverified ?? 0} unverified email(s) · ${summary?.total ?? 0} total`}
          </span>
        </div>
      </Card>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto", maxHeight: "70vh", overflowY: "auto" }}>
          <div style={{ minWidth: 1200 }}>
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
              <span>ID</span>
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
                  {activeQuery || processingFilter || verificationFilter
                    ? "Try clearing your search or filters."
                    : "Run a fetch from Pipeline actions above to pull in new emails."}
                </div>
              </div>
            ) : (
              emails.map((email) => (
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
                    ...rowAccentStyle(email.processing_status),
                  }}
                >
                  <span style={{ font: "600 12px/1 var(--font-mono)", color: "var(--text-faint)" }}>#{email.id}</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                    <Highlight text={email.sender} query={activeQuery} />
                  </span>
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
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Button size="sm" variant="secondary" onClick={() => setViewingId(email.id)}>
                      View
                    </Button>
                    <ProcessButton email={email} />
                    <OpenInGmailButton email={email} />
                    {email.image_count > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => setViewingImagesId(email.id)}>
                        <Icon.image size={13} /> {email.image_count}
                      </Button>
                    )}
                    <VerifyButton emailId={email.id} />
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        if (window.confirm(`Delete email #${email.id} and its extracted offers?`)) deleteEmail.mutate(email.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
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
              {total === 0 ? "0 results" : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}`}
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => updateParams({ page: String(page - 1) })}>
              ← Prev
            </Button>
            <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              Page {page} of {totalPages}
            </span>
            <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => updateParams({ page: String(page + 1) })}>
              Next →
            </Button>
          </div>
        </div>
      </Card>

      {viewingId !== null && <EmailDetailModal id={viewingId} onClose={() => setViewingId(null)} />}
      {viewingImagesId !== null && <ImagesModal id={viewingImagesId} onClose={() => setViewingImagesId(null)} />}
    </>
  );
}
