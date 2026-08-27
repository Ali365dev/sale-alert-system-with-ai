// Same backend as the DealPulse Expo app (mobile/eas.json) — this is a bare-RN
// port of the same product, not a separate service.

// production
// export const BASE_URL = 'https://sale-alert-system-with-ai.onrender.com/api';

// local dev — 10.0.2.2 is the Android emulator's alias for the host machine's
// localhost (the emulator has its own network namespace, so "localhost" here
// would mean the emulator itself, not your Mac). For a physical device, swap
// this for your machine's LAN IP instead (e.g. 192.168.x.x:8000).
export const BASE_URL = 'http://10.0.2.2:8000/api';
