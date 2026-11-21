import DeviceInfo from 'react-native-device-info';

import { Storage } from '../state/storage';

const DEVICE_ID_KEY = 'dealpulse:deviceId';

const generateId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;

// Survives uninstall/reinstall (iOS: stored in the Keychain; Android:
// ANDROID_ID), so a reinstall reuses the same device_id and the backend
// replaces that device's old push token instead of counting a new device.
const reinstallStableId = () => {
  try {
    const id = DeviceInfo.getUniqueIdSync();
    return id && id !== 'unknown' ? `dev-${id}` : null;
  } catch {
    return null;
  }
};

/** Per-device identifier for push tokens, preferences and sale alerts —
 * independent of the FCM token, so it works even when push permission is
 * denied or the token rotates. An id already saved in MMKV is kept as-is
 * (existing preferences and alerts are keyed by it); only a fresh install
 * picks up the reinstall-stable id. */
export const getDeviceId = () => {
  let id = Storage.getString(DEVICE_ID_KEY);
  if (!id) {
    id = reinstallStableId() || generateId();
    Storage.set(DEVICE_ID_KEY, id);
  }
  return id;
};
