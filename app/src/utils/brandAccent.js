/** Relative luminance of a #RRGGBB color (0 = black, 1 = white). */
export const luminance = (hex) => {
  const raw = String(hex || '').replace('#', '');
  if (raw.length < 6) return 0;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/** Text/icon color that stays readable on a filled accent surface. */
export const contrastOn = (hex) => (luminance(hex) > 0.55 ? '#10233F' : '#FFFFFF');

const isHex = (value) => typeof value === 'string' && /^#([0-9a-f]{6})$/i.test(value.trim());

/** Prefer vibrant / non-near-white / non-near-black swatches from image-colors. */
export const pickAccentFromResult = (result, fallback = '#F20D38') => {
  if (!result) return fallback;
  const candidates =
    result.platform === 'ios'
      ? [result.background, result.primary, result.secondary, result.detail]
      : [result.vibrant, result.dominant, result.darkVibrant, result.lightVibrant, result.average, result.muted];

  for (const color of candidates) {
    if (!isHex(color)) continue;
    const L = luminance(color);
    if (L < 0.08 || L > 0.92) continue;
    return color.toUpperCase();
  }

  const first = candidates.find(isHex);
  return first ? first.toUpperCase() : fallback;
};

/** Deterministic fallback when no logo can be sampled. */
export const accentFromName = (name = '', fallback = '#F20D38') => {
  const palette = ['#F5CB1B', '#F20D38', '#3478F6', '#16A36A', '#D97706', '#7C3AED', '#0EA5E9', '#E11D48'];
  const key = String(name).trim();
  if (!key) return fallback;
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) hash = (hash + key.charCodeAt(i) * (i + 1)) % palette.length;
  return palette[hash];
};

/** Soft wash for brand tiles — mixes accent toward white. */
export const softTint = (hex, whiteRatio = 0.86) => {
  const raw = String(hex || '').replace('#', '');
  if (raw.length < 6) return '#F5F7FA';
  const ratio = Math.min(1, Math.max(0, whiteRatio));
  const mix = (channel) => Math.round(parseInt(raw.slice(channel, channel + 2), 16) * (1 - ratio) + 255 * ratio);
  const toHex = (n) => n.toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(mix(0))}${toHex(mix(2))}${toHex(mix(4))}`;
};
