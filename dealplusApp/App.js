import { StatusBar } from 'react-native';
import React, { useEffect } from 'react';
import Navigation from './src/navigation/Navigation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/utils/CustomToast';
import { loadDeals } from './src/services/dealsService';
import { registerDeviceToken, requestNotificationPermission, setupPushListeners } from './src/services/pushNotifications';

const App = () => {
  useEffect(() => {
    loadDeals();

    // Best-effort: a denied permission or a registration failure should
    // never block app startup, so nothing here is awaited into the render path.
    let unsubscribeTokenRefresh;
    let unsubscribePushListeners;
    (async () => {
      try {
        const granted = await requestNotificationPermission();
        if (!granted) return;
        unsubscribeTokenRefresh = await registerDeviceToken();
        unsubscribePushListeners = setupPushListeners();
      } catch (error) {
        console.log('Push notification setup failed:', error?.message);
      }
    })();

    return () => {
      unsubscribeTokenRefresh?.();
      unsubscribePushListeners?.();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0A0A' }}>
        <Navigation />
        <Toast config={toastConfig} position="top" />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

export default App;
