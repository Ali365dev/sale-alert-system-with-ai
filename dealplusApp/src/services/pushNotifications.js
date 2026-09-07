import { PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { appAxios } from './apiInterceptors';
import { showToast } from '../utils/CustomToast';
import { navigate } from '../utils/NavigationUtil';
import useDataStore from '../state/dataStore';

/** Android 13+ requires the runtime POST_NOTIFICATIONS permission; iOS asks
 * via messaging().requestPermission(). Returns whether the app is allowed
 * to show notifications — callers should treat a `false` result as "skip
 * push setup", not as an error. */
export const requestNotificationPermission = async () => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }

  const authStatus = await messaging().requestPermission();
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
};

const registerToken = async (token) => {
  try {
    await appAxios.post('/notifications/devices/register', { token, platform: Platform.OS });
  } catch (error) {
    console.log('Failed to register device token:', error?.message);
  }
};

/** Fetches the current FCM token, registers it with the backend, and
 * re-registers automatically whenever the token rotates. Safe to call more
 * than once (e.g. app foregrounding) — registration is an upsert server-side. */
export const registerDeviceToken = async () => {
  try {
    const token = await messaging().getToken();
    if (token) await registerToken(token);
    return messaging().onTokenRefresh(registerToken);
  } catch (error) {
    console.log('Failed to get FCM token:', error?.message);
    return () => {};
  }
};

/** kind defaults to 'new-brand' (matches NotificationsScreen's known icon
 * set) since a generic admin-composed push has no natural "flash-sale" vs
 * "price-drop" distinction unless the payload says so.
 *
 * Called from every place a message can reach the app — foreground
 * (onMessage), background/quit tap (onNotificationOpenedApp,
 * getInitialNotification), and index.js's setBackgroundMessageHandler for a
 * message received while backgrounded/killed but never tapped — so the same
 * messageId can legitimately arrive here more than once; dedupe by id keeps
 * it a single row in the feed. Exported so index.js's background handler
 * (which runs outside this module's own listeners) can call it directly. */
export const pushToAlertsFeed = (remoteMessage) => {
  const { notification, data } = remoteMessage;
  if (!notification) return;

  const alert = {
    id: `push-${remoteMessage.messageId ?? Date.now()}`,
    kind: data?.kind ?? 'new-brand',
    title: notification.title ?? '',
    body: notification.body ?? '',
    time: 'Just now',
    brandId: data?.brandId ?? null,
    dealId: data?.dealId ?? null,
    read: false,
  };

  useDataStore.setState((state) =>
    state.alerts.some((a) => a.id === alert.id) ? state : { alerts: [alert, ...state.alerts] },
  );
};

// Falls back here — rather than doing nothing — whenever a notification was
// unmistakably tapped (remoteMessage exists) but its data payload doesn't
// resolve to a specific deal or brand: an admin-composed announcement push,
// a malformed/future payload shape, or a client on an older app version
// that doesn't recognize a new data field. A tap should always land
// somewhere, and the alerts feed built by pushToAlertsFeed() is always a
// contextually correct place to land on from a notification.
export const NOTIFICATION_FALLBACK_SCREEN = 'NotificationsScreen';

const asNonEmptyString = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** Maps a Firebase remoteMessage to { screen, params } — pure and exported
 * for testing independently of Firebase/navigation. Returns null only when
 * there is no remoteMessage at all (i.e. the app wasn't opened via a
 * notification tap); an existing-but-dataless/invalid message still
 * resolves to the fallback screen rather than null, since "no navigation
 * happens" would look like a broken tap to the user. Deal takes priority
 * over brand when a payload (incorrectly) carries both, since the deal is
 * the more specific destination. */
export const parseNotificationTarget = (remoteMessage) => {
  if (!remoteMessage) return null;

  const data = remoteMessage.data ?? {};
  const dealId = asNonEmptyString(data.dealId);
  const brandId = asNonEmptyString(data.brandId);

  if (dealId) return { screen: 'DealDetailScreen', params: { id: dealId } };
  if (brandId) return { screen: 'BrandDetailScreen', params: { id: brandId } };
  return { screen: NOTIFICATION_FALLBACK_SCREEN };
};

const navigateFromNotification = (remoteMessage) => {
  const target = parseNotificationTarget(remoteMessage);
  if (!target) return;
  navigate(target.screen, target.params);
};

/** Wires up foreground display, background/quit-state tap handling, and
 * initial-notification (app opened from a killed state by tapping a push).
 * Call once, e.g. from App.js's startup effect. Returns an unsubscribe fn. */
export const setupPushListeners = () => {
  const unsubscribeForeground = messaging().onMessage(async (remoteMessage) => {
    if (remoteMessage.notification) {
      showToast.success(remoteMessage.notification.body ?? '', remoteMessage.notification.title);
    }
    pushToAlertsFeed(remoteMessage);
  });

  const unsubscribeOpened = messaging().onNotificationOpenedApp((remoteMessage) => {
    pushToAlertsFeed(remoteMessage);
    navigateFromNotification(remoteMessage);
  });

  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (!remoteMessage) return;
      pushToAlertsFeed(remoteMessage);
      navigateFromNotification(remoteMessage);
    });

  return () => {
    unsubscribeForeground();
    unsubscribeOpened();
  };
};
