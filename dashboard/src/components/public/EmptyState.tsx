import type { ReactNode } from "react";

import { Icon } from "../icons";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        gap: 12,
        padding: "56px 24px",
        border: "1px dashed var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--surface-card)",
      }}
    >
      <span
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: "var(--surface-sunken)",
          color: "var(--text-faint)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon.inbox size={24} />
      </span>
      <div style={{ font: "var(--fw-semibold) 16px/1.3 var(--font-sans)", color: "var(--text-strong)" }}>{title}</div>
      <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)", maxWidth: 360 }}>{description}</p>
      {action}
    </div>
  );
}
