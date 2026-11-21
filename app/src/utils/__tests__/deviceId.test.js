import DeviceInfo from 'react-native-device-info';

import { Storage } from '../../state/storage';
import { getDeviceId } from '../deviceId';

jest.mock('react-native-device-info', () => ({ getUniqueIdSync: jest.fn() }));

const KEY = 'dealpulse:deviceId';

beforeEach(() => {
  Storage.delete(KEY);
  DeviceInfo.getUniqueIdSync.mockReset();
  DeviceInfo.getUniqueIdSync.mockReturnValue('FCDBD8EF-62FC-4ECB');
});

test('a fresh install uses the reinstall-stable device id and persists it', () => {
  const id = getDeviceId();
  expect(id).toBe('dev-FCDBD8EF-62FC-4ECB');
  expect(Storage.getString(KEY)).toBe(id);
});

test('returns the same id on every subsequent call', () => {
  const first = getDeviceId();
  expect(getDeviceId()).toBe(first);
  expect(getDeviceId()).toBe(first);
});

test('a reinstall (MMKV wiped) gets the same id back, so its push token is replaced', () => {
  const first = getDeviceId();
  Storage.delete(KEY);
  expect(getDeviceId()).toBe(first);
});

test('an existing install keeps the id it already saved', () => {
  Storage.set(KEY, 'mwp8uvnv-h369ykel-ww7erxn1');
  expect(getDeviceId()).toBe('mwp8uvnv-h369ykel-ww7erxn1');
});

test('falls back to a random id when no stable id is available', () => {
  DeviceInfo.getUniqueIdSync.mockReturnValue('unknown');
  const id = getDeviceId();
  expect(id).not.toContain('unknown');
  expect(id.length).toBeGreaterThan(0);
});
