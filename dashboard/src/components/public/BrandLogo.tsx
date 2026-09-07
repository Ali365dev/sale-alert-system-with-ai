import { useState } from "react";

import { useBrandLogoCandidates } from "../../hooks/useBrandLogoCandidates";
import { TONE_BG, TONE_FG, toneForName } from "../../lib/publicOffers";

export function BrandLogo({ name, size = 44, circle = false }: { name: string; size?: number; circle?: boolean }) {
  const tone = toneForName(name);
  const candidates = useBrandLogoCandidates(name);
  const [attempt, setAttempt] = useState(0);
  const src = candidates[attempt];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const radius = circle ? "50%" : size > 32 ? "var(--radius-md)" : "var(--radius-sm)";

  if (src) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: "var(--surface-card)",
          border: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flex: "0 0 auto",
        }}
      >
        <img
          key={src}
          src={src}
          alt={name}
          onError={() => setAttempt((a) => a + 1)}
          style={{ width: "78%", height: "78%", objectFit: "contain" }}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
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
