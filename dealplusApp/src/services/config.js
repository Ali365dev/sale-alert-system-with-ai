// Same backend as the DealPulse Expo app (mobile/eas.json) — this is a bare-RN
// port of the same product, not a separate service.

// production
export const BASE_URL = 'https://sale-alert-system-with-ai.onrender.com/api';

// local dev — your Mac's LAN IP, reachable from a physical Android or iOS
// device on the same WiFi network (the backend must also be bound to
// 0.0.0.0, not just 127.0.0.1, for that to actually work — see how it's
// started). The iOS Simulator can reach this too (it shares the Mac's
// network), so this one value covers Simulator + physical iOS + physical
// Android. Re-run `ipconfig getifaddr en0` if this ever changes (a
// different WiFi network, router reboot, etc.) — it's not stable forever.
// The one case this does NOT cover: the Android emulator, which needs its
// own special alias instead — http://10.0.2.2:8000/api — since its virtual
// network can't resolve the LAN IP the way a real device can.
// export const BASE_URL = 'http://192.168.18.38:8000/api';

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
