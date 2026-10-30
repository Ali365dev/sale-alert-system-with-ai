import { TONE_BG, TONE_FG, toneForName } from "../../lib/publicOffers";

const CATEGORY_ART: { test: RegExp; emoji: string }[] = [
  { test: /fashion|clothing|apparel/i, emoji: "👗" },
  { test: /electronic|tech/i, emoji: "🎧" },
  { test: /home|living|furniture/i, emoji: "🛋️" },
  { test: /beauty|cosmetic/i, emoji: "🧴" },
  { test: /sport|shoe|footwear/i, emoji: "👟" },
  { test: /kid|baby|toy/i, emoji: "🧸" },
  { test: /accessor|bag/i, emoji: "👜" },
];

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
  const emoji = CATEGORY_ART.find((item) => item.test.test(name))?.emoji ?? "🏷️";
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
        <span aria-hidden="true" style={{ fontSize: 23, lineHeight: 1 }}>{emoji}</span>
      </span>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--text-strong)" }}>{name}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{offerCount} offers</div>
      </div>
    </button>
  );
}
