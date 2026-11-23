import type { ReactNode } from "react";

/** A label, a figure and what it means. Colour on the figure only when it
 * carries meaning (failed in red, verified in green), never as decoration. */
export function StatCard({
  label,
  value,
  valueColor,
  caption,
}: {
  label: string;
  value: ReactNode;
  valueColor?: string;
  caption?: ReactNode;
}) {
  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
      }}
    >
      <div style={{ font: "var(--fw-medium) 0.8rem/1.2 var(--font-sans)", color: "var(--text-muted)" }}>{label}</div>
      <div
        style={{
          font: "var(--fw-semibold) 1.75rem/1.1 var(--font-sans)",
          fontVariantNumeric: "tabular-nums",
          color: valueColor ?? "var(--text-strong)",
        }}
      >
        {value}
      </div>
      {caption && <div style={{ fontSize: "0.8rem", lineHeight: 1.4, color: "var(--text-muted)" }}>{caption}</div>}
    </div>
  );
}
