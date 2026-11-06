import { useEffect } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastMessage {
  id: number;
  type: ToastType;
  text: string;
}

interface Props {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

const ICON_PATHS: Record<ToastType, string> = {
  success: "M20 6L9 17l-5-5",
  error: "M18 6L6 18M6 6l12 12",
  info: "M12 16v-4M12 8h.01",
};

const COLORS: Record<ToastType, string> = {
  success: "bg-green-500/[0.08] border-green-500/20 text-green-400",
  error: "bg-red-500/[0.08] border-red-500/20 text-red-400",
  info: "bg-blue-500/[0.08] border-blue-500/20 text-blue-400",
};

function ToastIcon({ type }: { type: ToastType }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" aria-hidden="true">
      {type === "info" ? (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d={ICON_PATHS.info} />
        </>
      ) : (
        <path d={ICON_PATHS[type]} />
      )}
    </svg>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${COLORS[toast.type]} animate-in`}>
      <ToastIcon type={toast.type} />
      <span className="flex-1">{toast.text}</span>
      <button onClick={onDismiss} aria-label="Dismiss notification" className="ml-1 opacity-60 hover:opacity-100 transition">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function Toast({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 px-3 pt-1" role="status" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}
