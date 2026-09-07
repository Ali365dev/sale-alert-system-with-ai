import { useState } from "react";

import { ApiConfigTab } from "../components/settings/ApiConfigTab";
import { EmailProcessingTab } from "../components/settings/EmailProcessingTab";
import { GoogleAccountTab } from "../components/settings/GoogleAccountTab";
import { PromptLibraryTab } from "../components/settings/PromptLibraryTab";
import { SaleFilterTab } from "../components/settings/SaleFilterTab";
import { SystemTab } from "../components/settings/SystemTab";
import { Tabs } from "../components/ui/Tabs";

const TABS = [
  { id: "google", label: "Google Account" },
  { id: "api", label: "API Configuration" },
  { id: "prompts", label: "AI Prompt Library" },
  { id: "email", label: "Email Processing" },
  { id: "sale_filter", label: "Sale Filter" },
  { id: "system", label: "System" },
];

export function Settings() {
  const [tab, setTab] = useState("google");

  return (
    <>
      <div>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
          Manage integrations, AI providers, prompts, and system preferences.
        </p>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "google" && <GoogleAccountTab />}
      {tab === "api" && <ApiConfigTab />}
      {tab === "prompts" && <PromptLibraryTab />}
      {tab === "email" && <EmailProcessingTab />}
      {tab === "sale_filter" && <SaleFilterTab />}
      {tab === "system" && <SystemTab />}
    </>
  );
}
