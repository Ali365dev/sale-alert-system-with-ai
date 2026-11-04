/**
 * Detects the user's country on first launch.
 *
 * Detection order (stops at first match):
 *  1. GPS + reverse-geocode — most accurate; requires location permission
 *  2. SIM country           — from react-native-device-info, works offline
 *  3. Device locale         — parsed from Intl, always instant
 *  4. IP geolocation        — silent network fallback
 *  5. Default               — 'PK' if all methods fail
 */
import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import DeviceInfo from 'react-native-device-info';
import { SUPPORTED_CODES, DEFAULT_REGION } from '../config/regions';

// ── 0. Location permission ────────────────────────────────────────────────────

/**
 * Requests location permission from the OS.
 * Android: shows the rationale dialog via PermissionsAndroid.
 * iOS: calls requestAuthorization so the system permission alert fires before
 *      getCurrentPosition is called (getCurrentPosition itself will also prompt
 *      if needed, but calling this first makes the timing explicit).
 */
export async function requestLocationPermission() {
  if (Platform.OS === 'android') {
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        {
          title: 'Location Access',
          message: 'Allow Deals More to use your location to show relevant deals in your region.',
          buttonPositive: 'Allow',
          buttonNegative: 'Skip',
        },
      );
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }
  // iOS — triggers the native "Allow location?" system alert.
  // The return value here is just the trigger; actual grant is determined when
  // getCurrentPosition fires (it succeeds if granted, errors if denied).
  Geolocation.requestAuthorization('whenInUse');
  return true;
}

// ── 1. GPS + reverse-geocode ─────────────────────────────────────────────────

const REVERSE_GEOCODE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const GPS_TIMEOUT_MS = 8000;
const GEOCODE_FETCH_TIMEOUT_MS = 5000;

export async function detectFromGPS() {
  return new Promise((resolve) => {
    Geolocation.getCurrentPosition(
      async ({ coords: { latitude, longitude } }) => {
        try {
          const url = `${REVERSE_GEOCODE_URL}?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`;
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), GEOCODE_FETCH_TIMEOUT_MS);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) { resolve(null); return; }
          const data = await res.json();
          const code = (data?.countryCode || '').toUpperCase() || null;
          console.log('[Region] GPS →', code);
          resolve(code);
        } catch {
          resolve(null);
        }
      },
      () => resolve(null),
      { timeout: GPS_TIMEOUT_MS, maximumAge: 300000, enableHighAccuracy: false },
    );
  });
}

// ── 3. SIM-based detection ────────────────────────────────────────────────────

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

// ── 4. Locale-based detection ─────────────────────────────────────────────────

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

// ── 5. IP geolocation ─────────────────────────────────────────────────────────

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
 * Returns { code, autoDetected } using non-GPS signals.
 * GPS detection is a separate step (detectFromGPS) that requires location
 * permission — call requestLocationPermission() + detectFromGPS() from the
 * UI before this, and skip this if GPS already produced a result.
 *
 * code        — ISO country code to use (e.g. "SA", "PK")
 * autoDetected — true if any signal produced a result; false if we fell back to DEFAULT_REGION
 */
export async function detectCountry() {
  const fromSIM = await detectFromSIM();
  if (fromSIM) return { code: fromSIM, autoDetected: true };

  const fromLocale = detectFromLocale();
  if (fromLocale) return { code: fromLocale, autoDetected: true };

  const fromIP = await detectFromIP();
  if (fromIP) return { code: fromIP, autoDetected: true };

  return { code: DEFAULT_REGION, autoDetected: false };
}
