// Manual Jest mock for react-native-mmkv — the real package is a native
// TurboModule and cannot initialize under Jest. Backed by an in-memory Map
// per instance (mirrors the package's own createMMKV.mock.ts), so every
// store built on src/state/storage.js (persisted Zustand stores, deviceId,
// guestName, the onboarding gate) works in tests without touching disk.
class MMKV {
  constructor() {
    this._data = new Map();
  }
  set(key, value) {
    this._data.set(key, value);
  }
  getString(key) {
    const v = this._data.get(key);
    return typeof v === 'string' ? v : undefined;
  }
  getNumber(key) {
    const v = this._data.get(key);
    return typeof v === 'number' ? v : undefined;
  }
  getBoolean(key) {
    const v = this._data.get(key);
    return typeof v === 'boolean' ? v : undefined;
  }
  contains(key) {
    return this._data.has(key);
  }
  delete(key) {
    this._data.delete(key);
  }
  getAllKeys() {
    return Array.from(this._data.keys());
  }
  clearAll() {
    this._data.clear();
  }
  trim() {}
}

module.exports = { MMKV };
