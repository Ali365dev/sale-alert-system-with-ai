// Same backend as the DealPulse Expo app (mobile/eas.json) — this is a bare-RN
// port of the same product, not a separate service.

// production
// export const BASE_URL = 'https://sale-alert-system-with-ai.onrender.com/api';

// local dev — the iOS Simulator shares your Mac's network directly, so
// "localhost" here means your Mac, not the simulator. For a physical iOS
// device (or the Android emulator) this needs to change:
//   - Android emulator: http://10.0.2.2:8000/api (its own network namespace —
//     "localhost" there would mean the emulator itself, not your Mac)
//   - Physical device: your machine's LAN IP instead, e.g. 192.168.x.x:8000
export const BASE_URL = 'http://localhost:8000/api';

// Microsoft Clarity project ID (clarity.microsoft.com).
export const CLARITY_PROJECT_ID = 'y9fq0ureju';
