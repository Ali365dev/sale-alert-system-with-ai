import { Storage } from '../../state/storage';
import { getDeviceId } from '../deviceId';

const KEY = 'dealpulse:deviceId';

beforeEach(() => {
  Storage.delete(KEY);
});

test('generates and persists an id on first call', () => {
  expect(Storage.getString(KEY)).toBeUndefined();
  const id = getDeviceId();
  expect(typeof id).toBe('string');
  expect(id.length).toBeGreaterThan(0);
  expect(Storage.getString(KEY)).toBe(id);
});

test('returns the same id on every subsequent call (stable per install)', () => {
  const first = getDeviceId();
  const second = getDeviceId();
  const third = getDeviceId();
  expect(second).toBe(first);
  expect(third).toBe(first);
});

test('two different (simulated) installs get different ids', () => {
  const first = getDeviceId();
  Storage.delete(KEY);
  const second = getDeviceId();
  expect(second).not.toBe(first);
});
