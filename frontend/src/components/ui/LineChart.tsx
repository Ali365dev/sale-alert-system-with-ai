export interface LinePoint {
  label: string;
  value: number;
}

export function LineChart({ points, height = 140, color = "var(--brand)" }: { points: LinePoint[]; height?: number; color?: string }) {
  if (points.length === 0) return null;

  const width = Math.max(points.length * 80, 240);
  const max = Math.max(...points.map((p) => p.value), 1);
  const padding = 20;
  const step = points.length > 1 ? (width - padding * 2) / (points.length - 1) : 0;

  const coords = points.map((p, i) => {
    const x = padding + i * step;
    const y = height - padding - (p.value / max) * (height - padding * 2);
    return { x, y, ...p };
  });

  const path = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMinYMid meet">
      <path d={path} fill="none" stroke={color} strokeWidth={2} />
      {coords.map((c) => (
        <g key={c.label}>
          <circle cx={c.x} cy={c.y} r={3.5} fill={color} />
          <text x={c.x} y={height - 4} fontSize={10} textAnchor="middle" fill="var(--text-muted)">
            {c.label}
          </text>
          <text x={c.x} y={c.y - 8} fontSize={10} textAnchor="middle" fill="var(--text-strong)">
            {c.value}
          </text>
        </g>
      ))}
    </svg>
  );
}
