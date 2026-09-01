// Manual Jest mock for @react-native-firebase/messaging — the real package
// constructs a native event emitter at import time, which throws under Jest
// (no native module registered). Only the surface src/services/pushNotifications.js
// actually calls is stubbed; nothing here sends or receives real notifications.
const instance = {
  requestPermission: jest.fn().mockResolvedValue(1),
  getToken: jest.fn().mockResolvedValue('mock-fcm-token'),
  onTokenRefresh: jest.fn(() => () => {}),
  onMessage: jest.fn(() => () => {}),
  onNotificationOpenedApp: jest.fn(() => () => {}),
  getInitialNotification: jest.fn().mockResolvedValue(null),
};

const messaging = () => instance;
messaging.AuthorizationStatus = { AUTHORIZED: 1, PROVISIONAL: 2, DENIED: 0, NOT_DETERMINED: -1 };

module.exports = messaging;
module.exports.default = messaging;
