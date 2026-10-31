/**
 * Detects the user's country on first launch.
 *
 * Detection order (stops at first match):
 *  1. SIM country    — from react-native-device-info (requires native rebuild)
 *  2. Device locale  — parsed from Intl, always instant, no network needed
 *  3. IP geolocation — silent fallback, no permission needed
 *  4. Default        — 'PK' if all methods fail
 */
import DeviceInfo from 'react-native-device-info';
import { SUPPORTED_CODES, DEFAULT_REGION } from '../config/regions';

// ── 1. SIM-based detection ────────────────────────────────────────────────────

async function detectFromSIM() {
  try {
    // getDeviceCountry() returns the ISO country code from the SIM card or
    // device region setting. Most accurate method — works offline.
    const country = await DeviceInfo.getDeviceCountry();
    const code = (country || '').toUpperCase();
    console.log('[Region] SIM/device country:', code);
    if (code && SUPPORTED_CODES.includes(code)) return code;
    // Return even unsupported codes so the store can record the real country
    return code || null;
  } catch {
    return null;
  }
}

// ── 2. Locale-based detection ─────────────────────────────────────────────────

/**
 * Extracts the BCP-47 region subtag from the device locale string.
 * e.g. "en-SA" → "SA", "ar_SA" → "SA", "en" → null
 */
function countryFromLocale(locale) {
  if (!locale) return null;
  // BCP-47 uses "-", some platforms use "_"
  const parts = locale.replace(/_/g, '-').split('-');
  // Region subtag is the second part when it's 2 uppercase letters
  for (let i = 1; i < parts.length; i++) {
    if (/^[A-Z]{2}$/.test(parts[i])) return parts[i];
  }
  return null;
}

function detectFromLocale() {
  try {
    // Intl is available in Hermes (React Native >= 0.70)
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const country = countryFromLocale(locale);
    console.log('[Region] locale:', locale, '→ country:', country);
    if (country && SUPPORTED_CODES.includes(country)) return country;
  } catch {
    // Intl not available — fall through to IP
  }
  return null;
}

// ── 3. IP geolocation ─────────────────────────────────────────────────────────

const IP_API_URL = 'https://ip-api.com/json?fields=countryCode';
const IP_API_TIMEOUT_MS = 5000;

async function detectFromIP() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IP_API_TIMEOUT_MS);
    const res = await fetch(IP_API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const country = data?.countryCode?.toUpperCase();
    console.log('[Region] IP API →', country);
    if (country && SUPPORTED_CODES.includes(country)) return country;
    // Country detected but not in our supported list — return it anyway so
    // the store can store the real country even if we fall back to PK for UI.
    return country ?? null;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns the detected ISO country code (e.g. "SA", "PK").
 * Falls back to DEFAULT_REGION if nothing resolves.
 * SIM and locale are instant; GPS shows OS permission dialog; IP is the silent fallback.
 */
export async function detectCountry() {
  const fromSIM = await detectFromSIM();
  if (fromSIM) return fromSIM;

  const fromLocale = detectFromLocale();
  if (fromLocale) return fromLocale;

  const fromIP = await detectFromIP();
  if (fromIP) return fromIP;

  return DEFAULT_REGION;
}
