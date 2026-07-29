import type { CSSProperties, ReactNode } from "react";

export function Card({
  children,
  style,
  padded = true,
}: {
  children: ReactNode;
  style?: CSSProperties;
  padded?: boolean;
}) {
  return (
    <section
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding: padded ? "18px 20px 20px" : undefined,
        display: "flex",
        flexDirection: "column",
        gap: 16,
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function CardHeader({ icon, title, aside }: { icon?: ReactNode; title: string; aside?: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      {icon}
      <h2
        style={{
          margin: 0,
          font: "var(--fw-semibold) 15px/1.2 var(--font-sans)",
          color: "var(--text-strong)",
        }}
      >
        {title}
      </h2>
      {aside && <span style={{ marginLeft: "auto" }}>{aside}</span>}
    </div>
  );
}
