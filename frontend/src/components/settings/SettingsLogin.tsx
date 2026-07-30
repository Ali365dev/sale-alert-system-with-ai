import { useState } from "react";

import { useSettingsLogin, useSettingsSession } from "../../api/settings";
import { Button } from "../ui/Button";
import { Card, CardHeader } from "../ui/Card";
import { Label } from "../ui/Field";
import { Icon } from "../icons";
import { MaskedKeyInput } from "./MaskedKeyInput";

export function SettingsLogin() {
  const { data: session } = useSettingsSession();
  const login = useSettingsLogin();
  const [password, setPassword] = useState("");

  const firstTime = session?.setup_required ?? false;

  return (
    <div style={{ display: "flex", justifyContent: "center", paddingTop: 60 }}>
      <Card style={{ maxWidth: 380, width: "100%" }}>
        <CardHeader title="Settings" icon={<Icon.target size={17} style={{ color: "var(--brand)" }} />} />
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {firstTime
            ? "No admin password is set yet. Choose one now — it becomes the password for this Settings page going forward."
            : "Enter the admin password to manage API keys, prompts, and configuration."}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            login.mutate(password);
          }}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div>
            <Label>{firstTime ? "Choose an admin password" : "Admin password"}</Label>
            <MaskedKeyInput value={password} onChange={setPassword} placeholder="••••••••" />
          </div>
          <Button type="submit" loading={login.isPending} disabled={!password}>
            {firstTime ? "Set password & continue" : "Log in"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
