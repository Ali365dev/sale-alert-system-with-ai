/**
 * @format
 */

import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';
import { pushToAlertsFeed } from './src/services/pushNotifications';

// Must be registered outside the React tree, before registerComponent —
// this is what lets a push notification be received while the app is
// backgrounded or fully killed (RNFirebase's requirement, not a style choice).
// Writes straight into the mmkv-persisted dataStore via pushToAlertsFeed so
// the notification is already in the in-app list by the time the user opens
// the app — not just when they happen to tap the system tray notification.
// Guarded: until google-services.json/GoogleService-Info.plist are wired in
// (see dealplusApp/src/services/pushNotifications.js), there's no native
// default Firebase app yet, and messaging() throws synchronously here — this
// runs before React even mounts, so an unguarded call crashes app startup
// entirely rather than just disabling push.
try {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    pushToAlertsFeed(remoteMessage);
  });
} catch (error) {
  console.log('Push notifications unavailable (Firebase not configured yet):', error?.message);
}

AppRegistry.registerComponent(appName, () => App);
