import { TONE_BG, TONE_FG, toneForName } from "../../lib/publicOffers";

export function BrandLogo({ name, size = 44 }: { name: string; size?: number }) {
  const tone = toneForName(name);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size > 32 ? "var(--radius-md)" : "var(--radius-sm)",
        background: TONE_BG[tone],
        color: TONE_FG[tone],
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        font: `800 ${Math.max(12, size * 0.36)}px/1 var(--font-sans)`,
        flex: "0 0 auto",
      }}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}
