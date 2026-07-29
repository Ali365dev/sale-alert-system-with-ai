import type { ReactNode } from "react";

import { useRunFetch } from "../../api/overview";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const runFetch = useRunFetch();

  return (
    <div style={{ display: "flex", alignItems: "stretch", minHeight: "100vh" }}>
      <Sidebar onRunFetch={() => runFetch.mutate()} fetching={runFetch.isPending} />
      <main style={{ flex: "1 1 auto", minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Header title={title} />
        <div style={{ display: "flex", flexDirection: "column", gap: 24, padding: "24px 28px 44px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
