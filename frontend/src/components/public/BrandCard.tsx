import { Link } from "react-router";

import { BrandLogo } from "./BrandLogo";

export function BrandCard({ name, offerCount, category }: { name: string; offerCount: number; category?: string | null }) {
  return (
    <Link
      to={`/deals/brand/${encodeURIComponent(name)}`}
      className="public-offer-card"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--surface-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding: 16,
        color: "var(--text-strong)",
        minWidth: 220,
      }}
    >
      <BrandLogo name={name} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          {offerCount} active offer{offerCount === 1 ? "" : "s"}
          {category ? ` · ${category}` : ""}
        </div>
      </div>
    </Link>
  );
}
