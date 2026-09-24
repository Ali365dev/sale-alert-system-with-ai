import { useState, useEffect, type CSSProperties } from "react";

import { logoImageCss, normalizeLogoTransform, type LogoTransform } from "../../lib/logoDisplay";
import { hostnameOf, TONE_BG, TONE_FG, toneForName } from "../../lib/publicOffers";

export type BrandLogoProps = {
  name: string;
  logoUrl?: string | null;
  website?: string | null;
  size?: number;
  circle?: boolean;
  /** When omitted, defaults to centered scale=1. */
  transform?: Partial<LogoTransform> | null;
  /** Prefer the saved logo_url only (no favicon fallback) — used by the editor preview. */
  strictUrl?: boolean;
  title?: string;
};

/** Same candidate order as the mobile app / list preview. */
export function logoDisplayCandidates(
  logoUrl: string | null | undefined,
  website: string | null | undefined,
  strictUrl = false,
): string[] {
  const out: string[] = [];
  if (logoUrl?.trim()) out.push(logoUrl.trim());
  if (!strictUrl) {
    const host = hostnameOf(website ?? null);
    if (host) {
      out.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`);
    }
  }
  return out;
}

/** Best available URL to seed the logo editor when logo_url is empty. */
export function suggestedLogoUrl(logoUrl: string | null | undefined, website: string | null | undefined): string {
  return logoDisplayCandidates(logoUrl, website, false)[0] ?? "";
}

/** Renders a brand mark the same way the mobile BrandLogo does: square/circle
 * crop + contain + saved scale/offset transform. */
export function BrandLogo({
  name,
  logoUrl = null,
  website = null,
  size = 44,
  circle = true,
  transform = null,
  strictUrl = false,
  title,
}: BrandLogoProps) {
  const tone = toneForName(name);
  const candidates = logoDisplayCandidates(logoUrl, website, strictUrl);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setAttempt(0);
    setFailed(false);
  }, [logoUrl, website, strictUrl, name]);

  const src = !failed ? candidates[attempt] : undefined;
  const t = normalizeLogoTransform(transform);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  const radius = circle ? "50%" : size > 32 ? "var(--radius-md)" : "var(--radius-sm)";
  const shell: CSSProperties = {
    width: size,
    height: size,
    borderRadius: radius,
    border: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flex: "0 0 auto",
    background: src ? "var(--surface-card)" : TONE_BG[tone],
    color: TONE_FG[tone],
    position: "relative",
  };

  if (src) {
    return (
      <div style={shell} title={title ?? name} aria-label={name}>
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          onError={() => {
            if (attempt >= candidates.length - 1) setFailed(true);
            else setAttempt((a) => a + 1);
          }}
          style={logoImageCss(size, t)}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        ...shell,
        font: `800 ${Math.max(12, size * 0.36)}px/1 var(--font-sans)`,
      }}
      aria-hidden
      title={title ?? (logoUrl ? "Failed to load logo" : "Logo unavailable")}
    >
      {initials || "?"}
    </div>
  );
}
