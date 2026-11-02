interface Props {
  progress: number; // 0–100
  label?: string;
}

export function ProgressBar({ progress, label }: Props) {
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-gray-500">{label ?? "Scanning…"}</span>
        <span className="text-xs font-semibold text-primary">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
