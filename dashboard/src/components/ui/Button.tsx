import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";

import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

const variantStyles: Record<Variant, CSSProperties> = {
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

function iconButtonSize(size: Size) {
  return size === "sm" ? 30 : 36;
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "style"> {
  icon: ReactNode;
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Perfect circle + flat neutral fill instead of the default rounded-square button — for avatar-style action rows (e.g. the Email Manager table). */
  circle?: boolean;
  style?: CSSProperties;
}

const circleStyle: CSSProperties = {
  borderRadius: "50%",
  border: "none",
  background: "var(--surface-sunken)",
  color: "var(--text-muted)",
  boxShadow: "none",
};

/** Compact square icon-only button for dense action rows (table rows, toolbars) — always carries a hover tooltip + `aria-label` since there's no visible text. */
export function IconButton({ icon, label, variant = "ghost", size = "sm", loading, circle, disabled, style, className, ...rest }: IconButtonProps) {
  const dim = iconButtonSize(size);
  return (
    <button
      type="button"
      aria-label={label}
      data-tooltip={label}
      className={["icon-tooltip", className].filter(Boolean).join(" ")}
      disabled={disabled || loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        width: dim,
        height: dim,
        padding: 0,
        borderRadius: "var(--radius-sm)",
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : loading ? 0.7 : 1,
        ...variantStyles[variant],
        ...(circle ? circleStyle : null),
        ...style,
      }}
      {...rest}
    >
      {loading ? <Spinner size={14} /> : icon}
    </button>
  );
}

interface IconLinkButtonProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "style"> {
  icon: ReactNode;
  label: string;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  circle?: boolean;
  style?: CSSProperties;
}

/** Anchor-tag counterpart to IconButton, for actions that open a link (Gmail, a brand's site, a filtered page) rather than firing a handler. */
export function IconLinkButton({ icon, label, variant = "ghost", size = "sm", circle, disabled, style, ...rest }: IconLinkButtonProps) {
  const dim = iconButtonSize(size);
  if (disabled) {
    return (
      <span
        aria-label={label}
        data-tooltip={label}
        className="icon-tooltip"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 auto",
          width: dim,
          height: dim,
          borderRadius: "var(--radius-sm)",
          opacity: 0.45,
          cursor: "not-allowed",
          ...variantStyles[variant],
          ...(circle ? circleStyle : null),
        }}
      >
        {icon}
      </span>
    );
  }
  return (
    <a
      aria-label={label}
      data-tooltip={label}
      className="icon-tooltip"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flex: "0 0 auto",
        width: dim,
        height: dim,
        borderRadius: "var(--radius-sm)",
        textDecoration: "none",
        ...variantStyles[variant],
        ...(circle ? circleStyle : null),
        ...style,
      }}
      {...rest}
    >
      {icon}
    </a>
  );
}
