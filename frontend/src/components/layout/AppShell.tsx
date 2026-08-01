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
        <Header title={title} />
        <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "24px 28px 44px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
