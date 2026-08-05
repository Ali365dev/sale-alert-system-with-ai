import type { ReactNode } from "react";

type Tone = "success" | "warning" | "danger" | "neutral" | "ai" | "brand";

const toneStyles: Record<Tone, React.CSSProperties> = {
  success: { color: "var(--success)", background: "var(--success-subtle)" },
  warning: { color: "var(--amber-600)", background: "var(--warning-subtle)" },
  danger: { color: "var(--red-600)", background: "var(--danger-subtle)" },
  neutral: { color: "var(--text-muted)", background: "var(--surface-sunken)" },
  ai: { color: "var(--ai)", background: "var(--ai-subtle)" },
  brand: { color: "var(--brand)", background: "var(--brand-subtle)" },
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 22,
        padding: "0 9px",
        borderRadius: "var(--radius-pill)",
        font: "600 11.5px/1 var(--font-mono)",
        whiteSpace: "nowrap",
        ...toneStyles[tone],
      }}
    >
      {children}
    </span>
  );
}
