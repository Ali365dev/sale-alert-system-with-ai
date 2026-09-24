/** Shared brand-logo display math — must stay in sync with
 * `app/api/logo_display.py` and dealplusApp BrandLogo. */

export const LOGO_SCALE_MIN = 0.5;
export const LOGO_SCALE_MAX = 3;
export const LOGO_OFFSET_MIN = -0.5;
export const LOGO_OFFSET_MAX = 0.5;
export const LOGO_SCALE_DEFAULT = 1;
export const LOGO_OFFSET_DEFAULT = 0;
/** Fraction of the mark filled by the image at scale=1 (mobile BrandLogo). */
export const LOGO_FILL_RATIO = 0.78;

export type LogoTransform = {
  logo_scale: number;
  logo_offset_x: number;
  logo_offset_y: number;
};

export const DEFAULT_LOGO_TRANSFORM: LogoTransform = {
  logo_scale: LOGO_SCALE_DEFAULT,
  logo_offset_x: LOGO_OFFSET_DEFAULT,
  logo_offset_y: LOGO_OFFSET_DEFAULT,
};

export function clampLogoScale(value: number): number {
  if (!Number.isFinite(value)) return LOGO_SCALE_DEFAULT;
  return Math.min(LOGO_SCALE_MAX, Math.max(LOGO_SCALE_MIN, value));
}

export function clampLogoOffset(value: number): number {
  if (!Number.isFinite(value)) return LOGO_OFFSET_DEFAULT;
  return Math.min(LOGO_OFFSET_MAX, Math.max(LOGO_OFFSET_MIN, value));
}

export function normalizeLogoTransform(partial?: Partial<LogoTransform> | null): LogoTransform {
  return {
    logo_scale: clampLogoScale(partial?.logo_scale ?? LOGO_SCALE_DEFAULT),
    logo_offset_x: clampLogoOffset(partial?.logo_offset_x ?? LOGO_OFFSET_DEFAULT),
    logo_offset_y: clampLogoOffset(partial?.logo_offset_y ?? LOGO_OFFSET_DEFAULT),
  };
}

/** CSS for the inner <img> inside a square overflow-hidden container. */
export function logoImageCss(
  containerSize: number,
  transform: Partial<LogoTransform> | null | undefined,
): {
  width: number;
  height: number;
  objectFit: "contain";
  transform: string;
  display: "block";
  userSelect: "none";
  pointerEvents: "none";
} {
  const t = normalizeLogoTransform(transform);
  const img = containerSize * LOGO_FILL_RATIO * t.logo_scale;
  return {
    width: img,
    height: img,
    objectFit: "contain",
    transform: `translate(${t.logo_offset_x * containerSize}px, ${t.logo_offset_y * containerSize}px)`,
    display: "block",
    userSelect: "none",
    pointerEvents: "none",
  };
}
