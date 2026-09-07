import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}

/** Compact "..." overflow button — opens a small dropdown of text actions, for
 * dense action rows where every action can't be its own icon button. */
export function IconMenuButton({ icon, label, items, circle }: { icon: ReactNode; label: string; items: MenuItem[]; circle?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", flex: "0 0 auto" }}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 30,
          height: 30,
          padding: 0,
          border: "1px solid transparent",
          borderRadius: circle ? "50%" : "var(--radius-sm)",
          background: circle ? "var(--surface-sunken)" : open ? "var(--surface-sunken)" : "transparent",
          color: "var(--text-muted)",
          cursor: "pointer",
        }}
      >
        {icon}
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 20,
            minWidth: 170,
            padding: 4,
            background: "var(--surface-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md, var(--shadow-sm))",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 10px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: "transparent",
                color: item.tone === "danger" ? "var(--danger)" : "var(--text-body)",
                font: "600 12.5px/1 var(--font-sans)",
                textAlign: "left",
                cursor: item.disabled ? "not-allowed" : "pointer",
                opacity: item.disabled ? 0.45 : 1,
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
