import { Storage } from '../state/storage';

const DEVICE_ID_KEY = 'dealpulse:deviceId';

const generateId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;

/** Stable per-install identifier, independent of the FCM push token — works
 * even when push permission is denied or the token rotates. Generated once
 * and persisted in MMKV. */
export const getDeviceId = () => {
  let id = Storage.getString(DEVICE_ID_KEY);
  if (!id) {
    id = generateId();
    Storage.set(DEVICE_ID_KEY, id);
  }
  return id;
};
