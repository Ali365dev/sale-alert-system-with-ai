import type { ReactNode } from "react";

import { isJobActive, useActiveJob, useStartJob } from "../../api/jobs";
import { useJobLifecycleNotifications } from "../../lib/notifications";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
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
