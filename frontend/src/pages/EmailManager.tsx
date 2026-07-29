import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  useCancelFetchEmails,
  useFetchEmails,
  useFetchEmailsStatus,
  useProcessPending,
  useProcessPendingStatus,
} from "../api/actions";
import {
  useDeleteEmail,
  useEmail,
  useEmails,
  useVerifyAllEmails,
  useVerifyAllEmailsStatus,
  useVerifyEmail,
} from "../api/emails";
import { useVerifyAllOffers, useVerifyAllStatus } from "../api/offers";
import { Icon } from "../components/icons";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Label, Select } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { StatCard } from "../components/ui/StatCard";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  legitimate: "success",
  suspicious: "warning",
  spam: "danger",
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function VerifyButton({ emailId }: { emailId: number }) {
  const verify = useVerifyEmail();
  return (
    <Button size="sm" variant="ghost" loading={verify.isPending} onClick={() => verify.mutate(emailId)}>
      {verify.isPending ? "Verifying" : "Verify AI"}
    </Button>
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
          <div><strong style={{ color: "var(--text-strong)" }}>Received:</strong> {formatDateTime(data.received_date)}</div>
          <div><strong style={{ color: "var(--text-strong)" }}>Offers extracted:</strong> {data.offers_count}</div>
          {data.status ? (
            <div>
              <strong style={{ color: "var(--text-strong)" }}>Status:</strong>{" "}
              <Badge tone={STATUS_TONE[data.status] ?? "neutral"}>{data.status}</Badge>
              {data.note && <div style={{ marginTop: 4 }}>{data.note}</div>}
            </div>
          ) : (
            <div style={{ color: "var(--text-muted)" }}>Not verified yet.</div>
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
        </div>
      )}
    </Modal>
  );
}

function FetchEmailsAction() {
  const queryClient = useQueryClient();
  const fetchEmails = useFetchEmails();
  const cancelFetch = useCancelFetchEmails();
  const status = useFetchEmailsStatus();
  const running = status.data?.running ?? false;
  const wasRunning = useRef(false);

  useEffect(() => {
    if (wasRunning.current && !running) {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
    }
    wasRunning.current = running;
  }, [running, queryClient]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Button loading={fetchEmails.isPending || running} onClick={() => fetchEmails.mutate()}>
          Fetch emails from Gmail
        </Button>
        {running && (
          <Button variant="danger" size="sm" loading={cancelFetch.isPending} onClick={() => cancelFetch.mutate()}>
            Cancel
          </Button>
        )}
        {status.data && (
          <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
            {running
              ? status.data.phase === "listing"
                ? "Listing messages…"
                : `Fetching ${status.data.done}/${status.data.total}…`
              : status.data.phase === "done"
                ? `Done — ${status.data.fetched} new email(s) saved.`
                : status.data.phase === "cancelled"
                  ? `Cancelled — ${status.data.fetched} email(s) saved before stopping.`
                  : status.data.phase === "error"
                    ? `Error: ${status.data.error}`
                    : null}
          </span>
        )}
      </div>
      {status.data && status.data.logs.length > 0 && (running || status.data.phase !== "idle") && (
        <div
          style={{
            maxHeight: 140,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column-reverse",
            gap: 2,
            background: "var(--surface-sunken)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            padding: "8px 10px",
            fontFamily: "var(--font-mono)",
            fontSize: 11.5,
          }}
        >
          {[...status.data.logs].reverse().map((log, i) => (
            <div key={i} style={{ display: "flex", gap: 8, color: "var(--text-muted)" }}>
              <span style={{ color: "var(--text-faint)", flex: "0 0 auto" }}>
                {new Date(log.time).toLocaleTimeString()}
              </span>
              <span>{log.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PipelineActions() {
  const processPending = useProcessPending();
  const processPendingStatus = useProcessPendingStatus(processPending.isPending || processPending.isSuccess);
  const processRunning = processPendingStatus.data?.running ?? false;

  const verifyAllOffers = useVerifyAllOffers();
  const verifyAllOffersStatus = useVerifyAllStatus(verifyAllOffers.isPending || (verifyAllOffers.isSuccess && !!verifyAllOffers.data));
  const verifyOffersRunning = verifyAllOffersStatus.data?.running ?? false;

  return (
    <Card>
      <CardHeader title="Pipeline actions" />
      <FetchEmailsAction />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Button variant="secondary" loading={processPending.isPending || processRunning} onClick={() => processPending.mutate()}>
          Process pending emails → offers
        </Button>
        <Button variant="secondary" loading={verifyAllOffers.isPending || verifyOffersRunning} onClick={() => verifyAllOffers.mutate()}>
          Verify all unverified offers
        </Button>
      </div>
      {(processRunning || (processPendingStatus.data && processPendingStatus.data.processed + processPendingStatus.data.failed > 0)) && (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {processRunning
            ? "Processing pending emails…"
            : processPendingStatus.data?.error
              ? `Error: ${processPendingStatus.data.error}`
              : `Done — ${processPendingStatus.data?.processed} offer(s) created, ${processPendingStatus.data?.failed} failed.`}
        </div>
      )}
      {(verifyOffersRunning || (verifyAllOffersStatus.data && verifyAllOffersStatus.data.done > 0)) && (
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {verifyOffersRunning
            ? `Verifying offers ${verifyAllOffersStatus.data?.done}/${verifyAllOffersStatus.data?.total}…`
            : `Done — ${verifyAllOffersStatus.data?.done} offer(s) checked, ${verifyAllOffersStatus.data?.failed} failed.`}
        </div>
      )}
    </Card>
  );
}

export function EmailManager() {
  const [statusFilter, setStatusFilter] = useState("");
  const { data, isLoading, isError } = useEmails(statusFilter || undefined);
  const deleteEmail = useDeleteEmail();
  const verifyAll = useVerifyAllEmails();
  const verifyAllStatus = useVerifyAllEmailsStatus(verifyAll.isPending || (verifyAll.isSuccess && !!data));
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [viewingImagesId, setViewingImagesId] = useState<number | null>(null);

  if (isLoading) return <div style={{ color: "var(--text-muted)" }}>Loading emails…</div>;
  if (isError || !data) return <div style={{ color: "var(--danger)" }}>Failed to load emails.</div>;

  const { emails, summary } = data;
  const running = verifyAllStatus.data?.running ?? false;

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <StatCard icon={<Icon.offer size={17} />} iconColor="var(--brand)" iconBg="var(--brand-subtle)" label="Total emails" value={summary.total} />
        <StatCard icon={<Icon.clock size={17} />} iconColor="var(--text-muted)" iconBg="var(--surface-sunken)" label="Unverified" value={summary.unverified} />
        <StatCard icon={<Icon.check size={17} />} iconColor="var(--success)" iconBg="var(--success-subtle)" label="Legitimate" value={summary.legitimate} valueColor="var(--success)" />
        <StatCard icon={<Icon.alert size={17} />} iconColor="var(--amber-600)" iconBg="var(--warning-subtle)" label="Suspicious" value={summary.suspicious} valueColor="var(--warning)" />
        <StatCard icon={<Icon.x size={17} />} iconColor="var(--danger)" iconBg="var(--danger-subtle)" label="Spam" value={summary.spam} valueColor="var(--danger)" />
      </div>

      <PipelineActions />

      <Card>
        <CardHeader title="Filter" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <div>
            <Label>Status</Label>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
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
              : `${summary.unverified} unverified email(s) · ${summary.total} total`}
          </span>
        </div>
      </Card>

      <Card padded={false} style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 1100 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "60px 200px 1fr 150px 90px 90px 120px 200px",
                gap: 12,
                padding: "11px 20px",
                background: "var(--surface-sunken)",
                borderBottom: "1px solid var(--border)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "var(--ls-wide)",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              <span>ID</span>
              <span>Sender</span>
              <span>Subject</span>
              <span>Received</span>
              <span>Offers</span>
              <span>Images</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {emails.map((email) => (
              <div
                key={email.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "60px 200px 1fr 150px 90px 90px 120px 200px",
                  alignItems: "center",
                  gap: 12,
                  padding: "var(--row-pad) 20px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 12.5,
                }}
              >
                <span style={{ font: "600 12px/1 var(--font-mono)", color: "var(--text-faint)" }}>#{email.id}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-muted)" }}>
                  {email.sender}
                </span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: "var(--text-strong)" }}>
                  {email.subject}
                </span>
                <span style={{ font: "500 12px/1 var(--font-mono)", color: "var(--text-muted)" }}>{formatDateTime(email.received_date)}</span>
                <span style={{ font: "600 12px/1 var(--font-mono)" }}>{email.offers_count}</span>
                <span>
                  {email.image_count > 0 ? (
                    <button
                      type="button"
                      onClick={() => setViewingImagesId(email.id)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: 0,
                        color: "var(--brand)",
                      }}
                    >
                      <Icon.image size={13} />
                      <span style={{ font: "600 12px/1 var(--font-mono)" }}>{email.image_count}</span>
                    </button>
                  ) : (
                    <span style={{ color: "var(--text-faint)" }}>—</span>
                  )}
                </span>
                {email.status ? (
                  <Badge tone={STATUS_TONE[email.status] ?? "neutral"}>{email.status}</Badge>
                ) : (
                  <Badge tone="neutral">unverified</Badge>
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <Button size="sm" variant="secondary" onClick={() => setViewingId(email.id)}>
                    View
                  </Button>
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
            ))}
          </div>
        </div>
      </Card>

      {viewingId !== null && <EmailDetailModal id={viewingId} onClose={() => setViewingId(null)} />}
      {viewingImagesId !== null && <ImagesModal id={viewingImagesId} onClose={() => setViewingImagesId(null)} />}
    </>
  );
}
