/** Shared with dashboard `lib/logoDisplay.ts` and `app/api/logo_display.py`. */
export const LOGO_SCALE_MIN = 0.5;
export const LOGO_SCALE_MAX = 3;
export const LOGO_OFFSET_MIN = -0.5;
export const LOGO_OFFSET_MAX = 0.5;
export const LOGO_SCALE_DEFAULT = 1;
export const LOGO_OFFSET_DEFAULT = 0;
export const LOGO_FILL_RATIO = 0.78;

export const normalizeLogoTransform = ({ logoScale, logoOffsetX, logoOffsetY } = {}) => {
  const scale = Number.isFinite(logoScale) ? logoScale : LOGO_SCALE_DEFAULT;
  const ox = Number.isFinite(logoOffsetX) ? logoOffsetX : LOGO_OFFSET_DEFAULT;
  const oy = Number.isFinite(logoOffsetY) ? logoOffsetY : LOGO_OFFSET_DEFAULT;
  return {
    logoScale: Math.min(LOGO_SCALE_MAX, Math.max(LOGO_SCALE_MIN, scale)),
    logoOffsetX: Math.min(LOGO_OFFSET_MAX, Math.max(LOGO_OFFSET_MIN, ox)),
    logoOffsetY: Math.min(LOGO_OFFSET_MAX, Math.max(LOGO_OFFSET_MIN, oy)),
  };
};
