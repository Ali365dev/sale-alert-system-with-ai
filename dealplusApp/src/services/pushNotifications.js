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
 * "price-drop" distinction unless the payload says so. */
const pushToAlertsFeed = (remoteMessage) => {
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

  useDataStore.setState((state) => ({ alerts: [alert, ...state.alerts] }));
};

const navigateFromNotification = (remoteMessage) => {
  const { data } = remoteMessage ?? {};
  if (data?.brandId) navigate('BrandDetailScreen', { id: data.brandId });
  else if (data?.dealId) navigate('DealDetailScreen', { id: data.dealId });
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
    navigateFromNotification(remoteMessage);
  });

  messaging()
    .getInitialNotification()
    .then((remoteMessage) => {
      if (remoteMessage) navigateFromNotification(remoteMessage);
    });

  return () => {
    unsubscribeForeground();
    unsubscribeOpened();
  };
};
