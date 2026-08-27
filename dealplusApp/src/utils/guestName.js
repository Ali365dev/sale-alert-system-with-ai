import { Storage } from '../state/storage';

const GUEST_NAME_KEY = 'dealpulse:guestName';

const generateName = () => `Guest ${Math.floor(1000 + Math.random() * 9000)}`;

/** A friendly display name for a guest (no account/auth exists yet) — generated
 * once and persisted in MMKV, so it stays stable across app opens. */
export const getGuestName = () => {
  let name = Storage.getString(GUEST_NAME_KEY);
  if (!name) {
    name = generateName();
    Storage.set(GUEST_NAME_KEY, name);
  }
  return name;
};
