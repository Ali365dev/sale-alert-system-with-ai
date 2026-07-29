import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--brand)",
    color: "var(--on-brand)",
    border: "1px solid transparent",
    boxShadow: "var(--shadow-brand)",
  },
  secondary: {
    background: "var(--surface-card)",
    color: "var(--text-strong)",
    border: "1px solid var(--border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-body)",
    border: "1px solid transparent",
  },
  danger: {
    background: "var(--danger-subtle)",
    color: "var(--danger)",
    border: "1px solid transparent",
  },
};

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  loading,
  disabled,
  children,
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        height: size === "sm" ? 40 : 48,
        padding: "0 16px",
        borderRadius: "var(--radius-sm)",
        font: "600 13.5px/1 var(--font-sans)",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : loading ? 0.75 : 1,
        width: fullWidth ? "100%" : undefined,
        ...variantStyles[variant],
        ...style,
      }}
      {...rest}
    >
      {loading ? "Working…" : children}
    </button>
  );
}
