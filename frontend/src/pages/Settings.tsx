import { useState } from "react";

import { ApiConfigTab } from "../components/settings/ApiConfigTab";
import { EmailProcessingTab } from "../components/settings/EmailProcessingTab";
import { GoogleAccountTab } from "../components/settings/GoogleAccountTab";
import { PromptLibraryTab } from "../components/settings/PromptLibraryTab";
import { SystemTab } from "../components/settings/SystemTab";
import { Tabs } from "../components/ui/Tabs";

const TABS = [
  { id: "google", label: "Google Account" },
  { id: "api", label: "API Configuration" },
  { id: "prompts", label: "AI Prompt Library" },
  { id: "email", label: "Email Processing" },
  { id: "system", label: "System" },
];

export function Settings() {
  const [tab, setTab] = useState("google");

  return (
    <>
      <div>
        <h1 style={{ margin: 0, font: "var(--fw-bold) 20px/1.2 var(--font-sans)", color: "var(--text-strong)" }}>Settings</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
          Manage integrations, AI providers, prompts, and system preferences.
        </p>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "google" && <GoogleAccountTab />}
      {tab === "api" && <ApiConfigTab />}
      {tab === "prompts" && <PromptLibraryTab />}
      {tab === "email" && <EmailProcessingTab />}
      {tab === "system" && <SystemTab />}
    </>
  );
}
