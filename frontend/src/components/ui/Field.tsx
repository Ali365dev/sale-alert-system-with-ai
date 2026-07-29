import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldStyle: React.CSSProperties = {
  height: 40,
  padding: "0 12px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-card)",
  color: "var(--text-strong)",
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};

export function Label({ children }: { children: ReactNode }) {
  return (
    <label
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: "var(--ls-wide)",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        display: "block",
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...fieldStyle, ...props.style }} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...fieldStyle, height: "auto", minHeight: 80, padding: "10px 12px", ...props.style }} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...fieldStyle, ...props.style }} />;
}

export function FieldGroup({ children }: { children: ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>;
}
