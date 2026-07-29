export interface BarListItem {
  name: string;
  count: number;
}

export function BarList({ items, color = "var(--brand)" }: { items: BarListItem[]; color?: string }) {
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {items.map((item) => (
        <div
          key={item.name}
          style={{
            display: "grid",
            gridTemplateColumns: "110px 1fr 40px",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 12.5,
              color: "var(--text-body)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.name}
          </span>
          <span style={{ height: 9, borderRadius: 99, background: "var(--surface-sunken)", display: "block" }}>
            <span
              style={{
                display: "block",
                height: 9,
                width: `${(item.count / max) * 100}%`,
                borderRadius: 99,
                background: color,
              }}
            />
          </span>
          <span style={{ font: "600 12px/1 var(--font-mono)", color: "var(--text-strong)", textAlign: "right" }}>
            {item.count}
          </span>
        </div>
      ))}
    </div>
  );
}
