export interface BarListItem {
  name: string;
  count: number;
}

/** Ranked list with thin bars. Only the leader takes the accent so the
 * eye lands on it; the rest stay neutral steps. */
export function BarList({ items }: { items: BarListItem[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <ol style={{ display: "flex", flexDirection: "column", gap: 12, margin: 0, padding: 0, listStyle: "none" }}>
      {items.map((item, index) => (
        <li key={item.name} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span
              style={{
                flex: "1 1 auto",
                minWidth: 0,
                fontSize: "0.875rem",
                color: "var(--text-body)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={item.name}
            >
              {item.name}
            </span>
            <span style={{ font: "var(--fw-medium) 0.8rem/1 var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--text-strong)" }}>
              {item.count.toLocaleString()}
            </span>
          </div>
          <span style={{ height: 4, borderRadius: 2, background: "var(--surface-sunken)", display: "block" }}>
            <span
              style={{
                display: "block",
                height: 4,
                width: `${(item.count / max) * 100}%`,
                borderRadius: 2,
                background: index === 0 ? "var(--brand)" : "var(--text-faint)",
              }}
            />
          </span>
        </li>
      ))}
    </ol>
  );
}
