import { Button } from "./Button";

export function Pagination({
  offset,
  pageSize,
  total,
  onChange,
}: {
  offset: number;
  pageSize: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  if (total <= pageSize) return null;
  return (
    <nav
      aria-label="Pagination"
      style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "12px 16px" }}
    >
      <span style={{ font: "500 0.8rem/1 var(--font-sans)", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
        {offset + 1}–{Math.min(offset + pageSize, total)} of {total.toLocaleString()}
      </span>
      <Button size="sm" variant="secondary" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - pageSize))}>
        Previous
      </Button>
      <Button size="sm" variant="secondary" disabled={offset + pageSize >= total} onClick={() => onChange(offset + pageSize)}>
        Next
      </Button>
    </nav>
  );
}
