import type { AppMode } from "../../types";

interface Props {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
}

const MODES: { id: AppMode; label: string }[] = [
  { id: "sale", label: "Sale Offers" },
  { id: "bank", label: "Bank Offers" },
];

export function ModeToggle({ mode, onChange }: Props) {
  return (
    <div className="flex bg-surface-2 border-b border-line px-3 py-2 gap-1.5 flex-shrink-0">
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition ${
            mode === m.id ? "bg-primary text-white" : "bg-surface-3 text-t2 hover:text-t1"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
