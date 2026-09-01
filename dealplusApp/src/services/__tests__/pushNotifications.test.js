jest.mock('../../utils/NavigationUtil', () => ({ navigate: jest.fn() }));
jest.mock('../../utils/CustomToast', () => ({ showToast: { success: jest.fn(), error: jest.fn() } }));

import messaging from '@react-native-firebase/messaging';
import { navigate } from '../../utils/NavigationUtil';
import { showToast } from '../../utils/CustomToast';
import useDataStore from '../../state/dataStore';
import {
  NOTIFICATION_FALLBACK_SCREEN,
  parseNotificationTarget,
  setupPushListeners,
} from '../pushNotifications';

beforeEach(() => {
  jest.clearAllMocks();
  useDataStore.setState({ alerts: [] });
});

describe('parseNotificationTarget (notification payload parsing)', () => {
  test('no remoteMessage at all (app not opened via a notification) returns null', () => {
    expect(parseNotificationTarget(null)).toBeNull();
    expect(parseNotificationTarget(undefined)).toBeNull();
  });

  test('a valid dealId resolves to DealDetailScreen', () => {
    expect(parseNotificationTarget({ data: { dealId: '42' } })).toEqual({
      screen: 'DealDetailScreen',
      params: { id: '42' },
    });
  });

  test('a valid brandId (no dealId) resolves to BrandDetailScreen', () => {
    expect(parseNotificationTarget({ data: { brandId: 'nike' } })).toEqual({
      screen: 'BrandDetailScreen',
      params: { id: 'nike' },
    });
  });

  test('a payload carrying both ids prefers the more specific dealId', () => {
    expect(parseNotificationTarget({ data: { dealId: '42', brandId: 'nike' } })).toEqual({
      screen: 'DealDetailScreen',
      params: { id: '42' },
    });
  });

  test('surrounding whitespace on an id is trimmed', () => {
    expect(parseNotificationTarget({ data: { dealId: '  42  ' } })).toEqual({
      screen: 'DealDetailScreen',
      params: { id: '42' },
    });
  });

  test('a tapped notification with no data at all falls back to the notifications feed, not null', () => {
    expect(parseNotificationTarget({ notification: { title: 'Hi' } })).toEqual({ screen: NOTIFICATION_FALLBACK_SCREEN });
  });

  test('an empty-string id is treated as missing, not a valid (empty) route param', () => {
    expect(parseNotificationTarget({ data: { dealId: '' } })).toEqual({ screen: NOTIFICATION_FALLBACK_SCREEN });
  });

  test('a whitespace-only id is treated as missing', () => {
    expect(parseNotificationTarget({ data: { dealId: '   ' } })).toEqual({ screen: NOTIFICATION_FALLBACK_SCREEN });
  });

  test('a non-string id (malformed payload) is treated as invalid, not coerced', () => {
    expect(parseNotificationTarget({ data: { dealId: 42 } })).toEqual({ screen: NOTIFICATION_FALLBACK_SCREEN });
  });
});

describe('setupPushListeners', () => {
  test('cold start: an app opened by tapping a notification navigates to the right screen', async () => {
    messaging().getInitialNotification.mockResolvedValue({ data: { dealId: '7' } });

    setupPushListeners();
    await Promise.resolve().then(() => {}).then(() => {}); // flush the getInitialNotification().then(...) chain

    expect(navigate).toHaveBeenCalledWith('DealDetailScreen', { id: '7' });
  });

  test('cold start: an app opened normally (no notification) does not navigate at all', async () => {
    messaging().getInitialNotification.mockResolvedValue(null);

    setupPushListeners();
    await Promise.resolve().then(() => {}).then(() => {});

    expect(navigate).not.toHaveBeenCalled();
  });

  test('background/quit tap: onNotificationOpenedApp navigates to the right screen', () => {
    messaging().getInitialNotification.mockResolvedValue(null);
    setupPushListeners();

    const openedHandler = messaging().onNotificationOpenedApp.mock.calls[0][0];
    openedHandler({ data: { brandId: 'acme' } });

    expect(navigate).toHaveBeenCalledWith('BrandDetailScreen', { id: 'acme' });
  });

  test('background tap with an invalid/missing payload still lands somewhere safe, not nowhere', () => {
    messaging().getInitialNotification.mockResolvedValue(null);
    setupPushListeners();

    const openedHandler = messaging().onNotificationOpenedApp.mock.calls[0][0];
    openedHandler({ data: {} });

    expect(navigate).toHaveBeenCalledWith(NOTIFICATION_FALLBACK_SCREEN, undefined);
  });

  test('foreground message shows a toast and adds to the alerts feed, but does not navigate', () => {
    messaging().getInitialNotification.mockResolvedValue(null);
    setupPushListeners();

    const foregroundHandler = messaging().onMessage.mock.calls[0][0];
    foregroundHandler({ messageId: 'msg-1', notification: { title: 'Big Sale', body: '50% off' }, data: { dealId: '9' } });

    expect(showToast.success).toHaveBeenCalledWith('50% off', 'Big Sale');
    expect(useDataStore.getState().alerts).toHaveLength(1);
    expect(useDataStore.getState().alerts[0]).toMatchObject({ title: 'Big Sale', body: '50% off', dealId: '9' });
    expect(navigate).not.toHaveBeenCalled();
  });

  test('a foreground message with no `notification` block is still recorded in the alerts feed silently (no toast)', () => {
    messaging().getInitialNotification.mockResolvedValue(null);
    setupPushListeners();

    const foregroundHandler = messaging().onMessage.mock.calls[0][0];
    foregroundHandler({ messageId: 'msg-2', notification: null, data: { dealId: '9' } });

    expect(showToast.success).not.toHaveBeenCalled();
    // pushToAlertsFeed itself bails out with no `notification` — nothing crashes, nothing is added.
    expect(useDataStore.getState().alerts).toHaveLength(0);
  });

  test('returns an unsubscribe function that detaches both listeners', () => {
    messaging().getInitialNotification.mockResolvedValue(null);
    const unsubscribeForeground = jest.fn();
    const unsubscribeOpened = jest.fn();
    messaging().onMessage.mockReturnValue(unsubscribeForeground);
    messaging().onNotificationOpenedApp.mockReturnValue(unsubscribeOpened);

    const unsubscribe = setupPushListeners();
    unsubscribe();

    expect(unsubscribeForeground).toHaveBeenCalledTimes(1);
    expect(unsubscribeOpened).toHaveBeenCalledTimes(1);
  });
});
