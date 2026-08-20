import { MMKV } from 'react-native-mmkv';

export const Storage = new MMKV({ id: 'storage' });

export const mmkvStorage = {
  setItem: (key, value) => Storage.set(key, value),
  getItem: (key) => Storage.getString(key) ?? null,
  removeItem: (key) => Storage.delete(key),
};
