import { PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { appAxios } from './apiInterceptors';
import { showToast } from '../utils/CustomToast';
import { navigate } from '../utils/NavigationUtil';
import { getDeviceId } from '../utils/deviceId';
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
  if (Platform.OS === 'ios') {
    // Visible in Xcode / Console.app when testing TestFlight or device builds.
    console.log('[FCM iOS] token:', token);
    console.log('[FCM iOS] device_id:', getDeviceId());
  }
  try {
    await appAxios.post('/notifications/devices/register', {
      token,
      platform: Platform.OS,
      device_id: getDeviceId(),
    });
    if (Platform.OS === 'ios') {
      console.log('[FCM iOS] registered with backend');
    }
  } catch (error) {
    console.log('Failed to register device token:', error?.message);
  }
};

/** iOS must register for remote messages (APNs) before FCM getToken() works.
 * Android is a no-op / already registered. */
const ensureRemoteMessagesRegistered = async () => {
  if (Platform.OS !== 'ios') return;
  const registered = messaging().isDeviceRegisteredForRemoteMessages;
  if (!registered) {
    await messaging().registerDeviceForRemoteMessages();
  }
};

/** Wait until APNs has handed Firebase a device token.
 * Calling getToken() before this yields an FCM token that cannot receive
 * TestFlight/production pushes (FCM "succeeds", device never wakes). */
const waitForApnsToken = async (attempts = 15, delayMs = 700) => {
  if (Platform.OS !== 'ios') return true;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const apns = await messaging().getAPNSToken();
      if (apns) {
        console.log('[FCM iOS] APNs token ready');
        return true;
      }
    } catch (error) {
      console.log('[FCM iOS] getAPNSToken:', error?.message);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  console.log('[FCM iOS] APNs token missing — Push capability / APNs .p8 / production entitlement');
  return false;
};

/** iOS: APNs device-token callback can lag registerDeviceForRemoteMessages().
 * Retry getToken briefly so TestFlight opens don't race and skip registration. */
const getTokenWithRetry = async (attempts = 5, delayMs = 800) => {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const token = await messaging().getToken();
      if (token) return token;
    } catch (error) {
      lastError = error;
    }
    if (i < attempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  if (lastError) throw lastError;
  return null;
};

/** Fetches the current FCM token, registers it with the backend, and
 * re-registers automatically whenever the token rotates. Safe to call more
 * than once (e.g. app foregrounding) — registration is an upsert server-side. */
export const registerDeviceToken = async () => {
  try {
    await ensureRemoteMessagesRegistered();
    const apnsReady = await waitForApnsToken();
    if (Platform.OS === 'ios' && !apnsReady) {
      // Still try getToken — some devices race past getAPNSToken() but FCM works;
      // log loudly so TestFlight Console.app shows the likely root cause.
      console.log('[FCM iOS] proceeding without confirmed APNs token');
    }
    const token = await getTokenWithRetry();
    if (token) {
      await registerToken(token);
    } else if (Platform.OS === 'ios') {
      console.log('[FCM iOS] getToken() returned empty — check APNs .p8 in Firebase + Release aps-environment=production');
    }
    return messaging().onTokenRefresh(registerToken);
  } catch (error) {
    console.log('Failed to get FCM token:', error?.message);
    if (Platform.OS === 'ios') {
      console.log('[FCM iOS] getToken failed — APNs registration, provisioning, or GoogleService-Info may be wrong');
    }
    return () => {};
  }
};

/** Re-upsert the current FCM token + device_id without attaching a new
 * onTokenRefresh listener. Call on foreground / after saving preferences so
 * devices whose tokens were deactivated by FCM (UNREGISTERED) get a live
 * token again and personalized offer alerts can find them. */
export const refreshDeviceTokenRegistration = async () => {
  try {
    await ensureRemoteMessagesRegistered();
    if (Platform.OS === 'ios') {
      await waitForApnsToken(8, 500);
    }
    const token = await getTokenWithRetry(3, 500);
    if (token) await registerToken(token);
  } catch (error) {
    console.log('Failed to refresh FCM token registration:', error?.message);
  }
};

/** Permission check + register. Returns whether push setup can proceed. */
export const ensurePushRegistration = async () => {
  const granted = await requestNotificationPermission();
  if (!granted) return false;
  await refreshDeviceTokenRegistration();
  return true;
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
  const dealId = asNonEmptyString(data.dealId) || asNonEmptyString(data.offerId);
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
      // App-icon banner (not the generic success toast with a check/?) so
      // foreground pushes look like a real system notification.
      showToast.push(
        remoteMessage.notification.body ?? '',
        remoteMessage.notification.title ?? 'Deals More',
      );
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
