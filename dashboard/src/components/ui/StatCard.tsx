import type { ReactNode } from "react";

export function StatCard({
  icon,
  iconColor,
  iconBg,
  label,
  labelColor,
  value,
  valueColor,
  caption,
  gradient,
}: {
  icon: ReactNode;
  iconColor: string;
  iconBg: string;
  label: string;
  labelColor?: string;
  value: ReactNode;
  valueColor?: string;
  caption?: ReactNode;
  gradient?: boolean;
}) {
  return (
    <div
      style={{
        background: gradient
          ? "linear-gradient(150deg, var(--warning-subtle), var(--surface-card) 70%)"
          : "var(--surface-card)",
        border: `1px solid ${gradient ? "var(--warning-subtle)" : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: iconBg,
            color: iconColor,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "var(--ls-wide)",
            textTransform: "uppercase",
            color: labelColor ?? "var(--text-muted)",
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          font: "800 34px/1 var(--font-mono)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "var(--ls-tight)",
          color: valueColor ?? "var(--text-strong)",
        }}
      >
        {value}
      </div>
      {caption && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{caption}</div>}
    </div>
  );
}
