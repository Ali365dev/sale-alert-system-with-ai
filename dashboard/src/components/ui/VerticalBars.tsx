export interface VerticalBarItem {
  label: string;
  value: number;
  color?: string;
}

export function VerticalBars({ items, color = "var(--brand)", height = 140 }: { items: VerticalBarItem[]; color?: string; height?: number }) {
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height, overflowX: "auto", paddingBottom: 4 }}>
      {items.map((item) => (
        <div key={item.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 36, flex: "1 0 auto" }}>
          <span style={{ font: "600 11px/1 var(--font-mono)", color: "var(--text-strong)" }}>{item.value}</span>
          <div
            style={{
              width: 22,
              height: Math.max((item.value / max) * (height - 40), 3),
              borderRadius: "4px 4px 0 0",
              background: item.color ?? color,
            }}
          />
          <span
            style={{
              font: "500 10.5px/1 var(--font-sans)",
              color: "var(--text-muted)",
              maxWidth: 48,
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
