import { useState } from "react";

import { useDeviceCount, useFcmStatus, useSaveFcmConfig, useSendNotification } from "../api/notifications";
import { useJobHistory, type Job } from "../api/jobs";
import { useOffers, type Offer } from "../api/offers";
import { getJobStatusStyle } from "../config/jobStatus";
import { Icon } from "../components/icons";
import { JobDetailModal } from "../components/jobs/JobDetailModal";
import { ProcessingPanel } from "../components/jobs/ProcessingPanel";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardHeader } from "../components/ui/Card";
import { Label, TextArea, TextInput } from "../components/ui/Field";
import { StatCard } from "../components/ui/StatCard";

const JOB_TYPE = "send_push_notification";

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function FirebaseSetupCard({ onSaved }: { onSaved: () => void }) {
  const [json, setJson] = useState("");
  const save = useSaveFcmConfig();

  return (
    <Card>
      <CardHeader icon={<Icon.shield size={17} />} title="Firebase setup required" />
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
        Paste the Firebase service-account JSON (Project Settings → Service Accounts → Generate new private key) to
        enable sending. It's encrypted before it's stored.
      </p>
      <TextArea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder='{"type": "service_account", "project_id": "…", …}'
        rows={6}
        style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
      />
      <Button
        loading={save.isPending}
        disabled={!json.trim()}
        onClick={() =>
          save.mutate(json, {
            onSuccess: () => {
              setJson("");
              onSaved();
            },
          })
        }
      >
        Save credentials
      </Button>
    </Card>
  );
}

/** Search-as-you-type offer picker — sets data.dealId on the push payload so
 * dealplusApp's pushNotifications.js (onNotificationOpenedApp/getInitialNotification)
 * deep-links straight to that offer's DealDetailScreen on tap. No offer
 * selected just opens the app to its default screen, same as before. */
function OfferPicker({ selected, onSelect }: { selected: Offer | null; onSelect: (offer: Offer | null) => void }) {
  const [query, setQuery] = useState("");
  const { data } = useOffers({});
  const q = query.trim().toLowerCase();
  const matches = q
    ? (data?.offers ?? [])
        .filter((o) => [o.title, o.brand].filter((v): v is string => !!v).some((v) => v.toLowerCase().includes(q)))
        .slice(0, 20)
    : [];

  if (selected) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 40,
          padding: "0 12px",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-sm)",
          background: "var(--surface-sunken)",
          fontSize: 13,
        }}
      >
        <Icon.tag size={14} style={{ color: "var(--brand)", flex: "0 0 auto" }} />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selected.brand ? `${selected.brand} — ` : ""}
          {selected.title ?? `Offer #${selected.id}`}
        </span>
        <button
          type="button"
          onClick={() => onSelect(null)}
          style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, flex: "0 0 auto" }}
        >
          Clear
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search offers by title or brand…" />
      {matches.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 10,
            maxHeight: 260,
            overflowY: "auto",
            background: "var(--surface-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          {matches.map((offer) => (
            <button
              key={offer.id}
              type="button"
              onClick={() => {
                onSelect(offer);
                setQuery("");
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: "8px 12px",
                fontSize: 12.5,
                color: "var(--text-body)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {offer.brand ? `${offer.brand} — ` : ""}
              {offer.title ?? `Offer #${offer.id}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Mirrors the backend's own fallback logic for the automatic-pipeline
 * notification (services/jobs/email_automation.py::_send_offer_notification)
 * so a manually-composed "from an offer" notification reads the same way
 * an automatic one would. */
function offerToTitle(offer: Offer): string {
  if (offer.title) return offer.title;
  const discount = offer.discount_percentage ? `${Math.round(offer.discount_percentage)}% off` : offer.offer_value ?? "";
  if (offer.brand && discount) return `${offer.brand} — ${discount}`;
  return offer.brand ?? `Offer #${offer.id}`;
}
function offerToBody(offer: Offer): string {
  return offer.summary ?? offerToTitle(offer);
}

function ComposeCard({ deviceCount }: { deviceCount: number }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [linkedOffer, setLinkedOffer] = useState<Offer | null>(null);
  const send = useSendNotification();
  const [visibleJobId, setVisibleJobId] = useState<number | null>(null);

  const canSend = title.trim().length > 0 && body.trim().length > 0 && deviceCount > 0;

  return (
    <Card>
      <CardHeader icon={<Icon.bell size={17} />} title="Compose" />
      <div>
        <Label>Fill from offer (optional)</Label>
        <OfferPicker
          selected={linkedOffer}
          onSelect={(offer) => {
            setLinkedOffer(offer);
            if (offer) {
              setTitle(offerToTitle(offer));
              setBody(offerToBody(offer));
            }
          }}
        />
        <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--text-faint)" }}>
          Picking an offer fills the title/body below from it — edit them freely afterward. It also makes
          tapping the notification open this offer directly instead of just the app.
        </p>
      </div>
      <div>
        <Label>Title</Label>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Flash sale — 50% off today" maxLength={100} />
      </div>
      <div>
        <Label>Body</Label>
        <TextArea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tap to see today's top deals." rows={3} maxLength={240} />
      </div>
      <Button
        disabled={!canSend}
        loading={send.isPending}
        onClick={() =>
          send.mutate(
            {
              title: title.trim(),
              body: body.trim(),
              data: linkedOffer ? { dealId: String(linkedOffer.id) } : undefined,
            },
            {
              onSuccess: (data) => {
                setVisibleJobId(data.jobId);
                setTitle("");
                setBody("");
                setLinkedOffer(null);
              },
            },
          )
        }
      >
        {deviceCount > 0 ? `Send to ${deviceCount} device${deviceCount === 1 ? "" : "s"}` : "No devices registered yet"}
      </Button>

      {visibleJobId !== null && <ProcessingPanel jobId={visibleJobId} />}
    </Card>
  );
}

function HistoryTable() {
  const { data, isLoading } = useJobHistory({ jobType: JOB_TYPE, limit: 20 });
  const [detailId, setDetailId] = useState<number | null>(null);
  const jobs = data?.jobs ?? [];

  return (
    <Card padded={false} style={{ overflow: "hidden" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
        <CardHeader title="Send history" />
      </div>

      {isLoading && <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>Loading…</div>}
      {!isLoading && jobs.length === 0 && (
        <div style={{ padding: 24, color: "var(--text-muted)", fontSize: 13 }}>No notifications sent yet.</div>
      )}

      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 720 }}>
          {jobs.map((job: Job) => {
            const style = getJobStatusStyle(job);
            const payload = job.payload as { title?: string; body?: string } | null;
            const result = job.result as { total_devices_at_send?: number } | null;
            return (
              <div
                key={job.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 140px 90px 90px 100px",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 12.5,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: "var(--text-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {payload?.title ?? "(untitled)"}
                  </div>
                  <div style={{ color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {payload?.body ?? ""}
                  </div>
                </div>
                <Badge tone={style.tone}>{style.label}</Badge>
                <span style={{ font: "500 12px/1 var(--font-mono)", color: "var(--text-muted)" }}>{formatDateTime(job.started_at)}</span>
                <span style={{ font: "600 12px/1 var(--font-mono)" }}>{result?.total_devices_at_send ?? "—"}</span>
                <span style={{ font: "600 12px/1 var(--font-mono)", color: job.failed > 0 ? "var(--danger)" : "var(--text-muted)" }}>
                  {job.failed}
                </span>
                <Button size="sm" variant="secondary" onClick={() => setDetailId(job.id)}>
                  Details
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {detailId !== null && <JobDetailModal jobId={detailId} onClose={() => setDetailId(null)} />}
    </Card>
  );
}

export function NotificationManager() {
  const deviceCount = useDeviceCount();
  const fcmStatus = useFcmStatus();
  const configured = fcmStatus.data ?? false;

  return (
    <>
      <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
        Compose and send push notifications to every registered dealplusApp device.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
        <StatCard
          icon={<Icon.mail size={17} />}
          iconColor="var(--brand)"
          iconBg="var(--brand-subtle)"
          label="Registered devices"
          value={deviceCount.data ?? "—"}
        />
        <StatCard
          icon={<Icon.shield size={17} />}
          iconColor={configured ? "var(--success)" : "var(--amber-600)"}
          iconBg={configured ? "var(--success-subtle)" : "var(--warning-subtle)"}
          label="Firebase"
          value={fcmStatus.isLoading ? "…" : configured ? "Configured" : "Not set up"}
        />
      </div>

      {!fcmStatus.isLoading && !configured && <FirebaseSetupCard onSaved={() => fcmStatus.refetch()} />}
      {configured && <ComposeCard deviceCount={deviceCount.data ?? 0} />}

      <HistoryTable />
    </>
  );
}
