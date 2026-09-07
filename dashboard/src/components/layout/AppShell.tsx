import type { ReactNode } from "react";

import { isJobActive, useActiveJob, useStartJob } from "../../api/jobs";
import { useSettingsSession } from "../../api/settings";
import { useJobLifecycleNotifications } from "../../lib/notifications";
import { SettingsLogin } from "../settings/SettingsLogin";
import { LoadingState } from "../ui/Spinner";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

/** Every dashboard page renders through here — the admin login gate lives
 * at this single choke point rather than being duplicated per-page. */
export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const { data: session, isLoading } = useSettingsSession();

  if (isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <LoadingState />
      </div>
    );
  }

  if (!session?.authenticated) {
    return <SettingsLogin />;
  }

  return <AuthedShell title={title}>{children}</AuthedShell>;
}

/** Split out so the job-polling hooks below only ever mount once an admin
 * session is confirmed — never fired while the login screen is showing. */
function AuthedShell({ title, children }: { title: string; children: ReactNode }) {
  const startEmailSync = useStartJob("email_sync");
  const activeEmailSync = useActiveJob("email_sync");
  useJobLifecycleNotifications();

  return (
    <div style={{ display: "flex", alignItems: "stretch", minHeight: "100vh" }}>
      <Sidebar
        onRunFetch={() => startEmailSync.mutate(undefined)}
        fetching={startEmailSync.isPending || isJobActive(activeEmailSync.data?.status)}
      />
      <main style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Header />
        <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "24px 28px 44px" }}>
          {/* Pages that render their own in-page header (e.g. Email Manager)
             pass an empty title to skip this generic one and avoid a duplicate. */}
          {title && (
            <h1 style={{ margin: 0, font: "var(--fw-bold) 22px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>{title}</h1>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
