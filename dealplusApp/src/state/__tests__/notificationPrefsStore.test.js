import useNotificationPrefsStore from '../notificationPrefsStore';

const DEFAULTS = {
  pushEnabled: true,
  newDealsFromFollowedBrands: true,
  priceDropAlerts: true,
  expiringSoonReminders: true,
  weeklyDigest: false,
};

beforeEach(() => {
  useNotificationPrefsStore.setState(DEFAULTS, false);
});

test('defaults match the documented opt-in/opt-out state', () => {
  expect(useNotificationPrefsStore.getState()).toMatchObject(DEFAULTS);
});

test('setPref flips a single boolean without touching the others', () => {
  useNotificationPrefsStore.getState().setPref('weeklyDigest', true);
  const state = useNotificationPrefsStore.getState();
  expect(state.weeklyDigest).toBe(true);
  expect(state.pushEnabled).toBe(true);
  expect(state.priceDropAlerts).toBe(true);
});

test('setPref can turn an on-by-default pref off', () => {
  useNotificationPrefsStore.getState().setPref('pushEnabled', false);
  expect(useNotificationPrefsStore.getState().pushEnabled).toBe(false);
});
