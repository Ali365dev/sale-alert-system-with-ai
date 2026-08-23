import { useState } from "react";

import { useDeviceCount, useFcmStatus, useSaveFcmConfig, useSendNotification } from "../api/notifications";
import { useJobHistory, type Job } from "../api/jobs";
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

function ComposeCard({ deviceCount }: { deviceCount: number }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const send = useSendNotification();
  const [visibleJobId, setVisibleJobId] = useState<number | null>(null);

  const canSend = title.trim().length > 0 && body.trim().length > 0 && deviceCount > 0;

  return (
    <Card>
      <CardHeader icon={<Icon.bell size={17} />} title="Compose" />
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
            { title: title.trim(), body: body.trim() },
            {
              onSuccess: (data) => {
                setVisibleJobId(data.jobId);
                setTitle("");
                setBody("");
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
