import { Icon } from "../icons";
import { TONE_BG, TONE_FG, toneForName } from "../../lib/publicOffers";

export function CategoryCard({
  name,
  offerCount,
  active,
  onClick,
}: {
  name: string;
  offerCount: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const tone = toneForName(name);
  return (
    <button
      type="button"
      onClick={onClick}
      className="public-offer-card"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 10,
        background: active ? TONE_BG[tone] : "var(--surface-card)",
        border: `1px solid ${active ? TONE_FG[tone] : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-sm)",
        padding: 16,
        cursor: "pointer",
        minWidth: 150,
        textAlign: "left",
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: "var(--radius-sm)",
          background: TONE_BG[tone],
          color: TONE_FG[tone],
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon.tag size={16} />
      </span>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-strong)" }}>{name}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{offerCount} offers</div>
      </div>
    </button>
  );
}
