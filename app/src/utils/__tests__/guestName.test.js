import { Storage } from '../../state/storage';
import { getGuestName } from '../guestName';

const KEY = 'dealpulse:guestName';

beforeEach(() => {
  Storage.delete(KEY);
});

test('generates a name in the "Guest ####" format on first call', () => {
  const name = getGuestName();
  expect(name).toMatch(/^Guest \d{4}$/);
});

test('persists the same name across calls', () => {
  const first = getGuestName();
  expect(getGuestName()).toBe(first);
});
