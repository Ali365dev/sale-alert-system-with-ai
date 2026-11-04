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

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
};

const COLORS: Record<ToastType, string> = {
  success: "bg-green-900/20 border-green-500/30 text-green-400",
  error: "bg-red-900/20 border-red-500/30 text-red-400",
  info: "bg-blue-900/20 border-blue-500/30 text-blue-400",
};

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${COLORS[toast.type]} animate-in`}>
      <span className="font-bold mt-0.5">{ICONS[toast.type]}</span>
      <span className="flex-1">{toast.text}</span>
      <button onClick={onDismiss} className="ml-1 opacity-60 hover:opacity-100 transition">✕</button>
    </div>
  );
}

export function Toast({ toasts, onDismiss }: Props) {
  if (toasts.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 px-3 pt-1">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>
  );
}
