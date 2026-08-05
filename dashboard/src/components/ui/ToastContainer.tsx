import type { ReactElement } from "react";

import type { ToastTone } from "../../store/toastStore";
import { useToastStore } from "../../store/toastStore";
import { Icon } from "../icons";

const TONE_STYLE: Record<ToastTone, { border: string; iconBg: string; iconColor: string; icon: (p: { size: number }) => ReactElement }> = {
  success: { border: "var(--success-subtle)", iconBg: "var(--success-subtle)", iconColor: "var(--success)", icon: Icon.check },
  error: { border: "var(--danger-subtle)", iconBg: "var(--danger-subtle)", iconColor: "var(--danger)", icon: Icon.x },
  info: { border: "var(--ai-subtle)", iconBg: "var(--ai-subtle)", iconColor: "var(--ai)", icon: Icon.sparkle },
};

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        zIndex: 100,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxWidth: 360,
      }}
    >
      {toasts.map((t) => {
        const style = TONE_STYLE[t.tone];
        const ToastIcon = style.icon;
        return (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              background: "var(--surface-card)",
              border: `1px solid ${style.border}`,
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-lg)",
              padding: "12px 14px",
            }}
          >
            <span
              style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                background: style.iconBg,
                color: style.iconColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 22px",
              }}
            >
              <ToastIcon size={12} />
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.4, color: "var(--text-body)", flex: "1 1 auto" }}>{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              style={{
                border: "none",
                background: "transparent",
                color: "var(--text-faint)",
                cursor: "pointer",
                fontSize: 13,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
