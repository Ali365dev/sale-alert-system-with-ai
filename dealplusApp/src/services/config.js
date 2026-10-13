// Same backend as the Deals More Expo app (mobile/eas.json) — this is a bare-RN
// port of the same product, not a separate service.

import { Platform } from 'react-native';

// production — used for release builds. Sale Alerts must be deployed here or
// product URL analyze returns 404.
const PRODUCTION_API = 'https://sale-alert-system-with-ai.onrender.com/api';

// local — Mac LAN IP for physical devices + iOS Simulator on the same Wi‑Fi.
// Android emulator needs 10.0.2.2 instead of the LAN IP.
// Re-run `ipconfig getifaddr en0` if Wi‑Fi changes.
const LOCAL_LAN_API = 'http://192.168.18.43:8000/api';
const LOCAL_SIM_API =
  Platform.OS === 'android' ? 'http://10.0.2.2:8000/api' : 'http://127.0.0.1:8000/api';

// Prefer LAN so a physical phone on the same Wi‑Fi can hit the Mac. Fall back
// to loopback for Simulator / Emulator when __DEV__ is true.
const LOCAL_API = LOCAL_LAN_API;

// In development, talk to the local API (has Sale Alerts). Release builds keep
// production. Flip USE_LOCAL_API to false to force production while developing.
const USE_LOCAL_API = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export const BASE_URL = USE_LOCAL_API ? LOCAL_API : PRODUCTION_API;

// Keep unused helpers referenced so the file documents all options clearly.
void LOCAL_SIM_API;

// Microsoft Clarity project ID (clarity.microsoft.com).
export const CLARITY_PROJECT_ID = 'y9fq0ureju';

// Google Sign-In "Web client ID" (not an Android/iOS client ID) — required
// by @react-native-google-signin/google-signin's `webClientId` config, and
// by Firebase Auth to verify the Google credential. Get it once Google is
// enabled as a sign-in provider in the Firebase console (the "sale-alert-sys"
// project already backing FCM push here) — Authentication > Sign-in method
// > Google > Web SDK configuration > Web client ID. Empty = "Continue with
// Google" is disabled client-side (see googleAuth.js).
export const GOOGLE_WEB_CLIENT_ID = '254426897331-d1vq81m8rtj3oef8asfvlgu050tvtf7d.apps.googleusercontent.com';

// iOS OAuth client ID from GoogleService-Info.plist (CLIENT_ID). Used as
// `iosClientId` when configuring Google Sign-In on iOS.
export const GOOGLE_IOS_CLIENT_ID = '254426897331-8u2f992de8mccrl4q4cmskmk85r2hhf0.apps.googleusercontent.com';
