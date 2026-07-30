import { useConnectGoogle, useDisconnectGoogle, useGoogleAccount } from "../../api/settings";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { LoadingState } from "../ui/Spinner";
import { Icon } from "../icons";

function formatDateTime(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export function GoogleAccountTab() {
  const { data, isLoading } = useGoogleAccount();
  const disconnect = useDisconnectGoogle();
  const reconnect = useConnectGoogle();

  if (isLoading) return <LoadingState />;

  return (
    <Card>
      <CardHeader title="Google Account" icon={<Icon.mail size={17} style={{ color: "var(--brand)" }} />} />

      {data?.connected ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge tone="success">Connected</Badge>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Email</span>
              <span style={{ color: "var(--text-strong)", fontFamily: "var(--font-mono)" }}>{data.email ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Messages in mailbox</span>
              <span style={{ color: "var(--text-strong)", fontFamily: "var(--font-mono)" }}>{data.messages_total ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Threads</span>
              <span style={{ color: "var(--text-strong)", fontFamily: "var(--font-mono)" }}>{data.threads_total ?? "—"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text-muted)" }}>Last sync</span>
              <span style={{ color: "var(--text-strong)", fontFamily: "var(--font-mono)" }}>{formatDateTime(data.last_sync)}</span>
            </div>
          </div>
          {data.error && (
            <div style={{ fontSize: 12.5, color: "var(--danger)" }}>
              Connected, but couldn't reach Gmail just now: {data.error}
            </div>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <Button variant="secondary" loading={reconnect.isPending} onClick={() => reconnect.mutate()}>
              Reconnect
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (window.confirm("Disconnect Google? Gmail sync will stop until you reconnect. Already-analyzed emails and offers are kept.")) {
                  disconnect.mutate();
                }
              }}
              loading={disconnect.isPending}
            >
              Disconnect
            </Button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Badge tone="neutral">Not connected</Badge>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Connect your Gmail account to start fetching and analyzing emails. This opens a browser consent screen —
            if it doesn't appear automatically, check the server log for a URL to open manually.
          </p>
          <Button loading={reconnect.isPending} onClick={() => reconnect.mutate()}>
            Connect Google
          </Button>
        </>
      )}
    </Card>
  );
}
