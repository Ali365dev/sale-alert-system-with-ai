import { StatusBar, AppState } from 'react-native';
import React, { useEffect, useRef } from 'react';
import { initialize as initializeClarity } from '@microsoft/react-native-clarity';
import Navigation from './src/navigation/Navigation';
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/utils/CustomToast';
import { loadDeals } from './src/services/dealsService';
import {
  refreshDeviceTokenRegistration,
  registerDeviceToken,
  requestNotificationPermission,
  setupPushListeners,
} from './src/services/pushNotifications';
import { configureGoogleSignIn } from './src/services/googleAuth';
import { CLARITY_PROJECT_ID } from './src/services/config';
import useTheme from './src/hooks/useTheme';
import { shouldLoadNativePackage } from './src/utils/turboModules';

function AppToast() {
  const insets = useSafeAreaInsets();
  // Live inset wins over StatusBar.currentHeight (null on iOS) so top toasts
  // clear the notch / status bar instead of being clipped.
  return <Toast config={toastConfig} position="top" topOffset={Math.max(insets.top, 20) + 12} />;
}

function hideNativeSplash() {
  // OS splash covers cold start only — hide as soon as JS mounts so we don't
  // wait on the old animated SplashScreen (min 1.2s + data load).
  if (!shouldLoadNativePackage('RNBootSplash')) return;
  try {
    const pkg = require('react-native-bootsplash');
    const BootSplash = pkg.default ?? pkg;
    BootSplash?.hide({ fade: true });
  } catch (error) {
    if (__DEV__) {
      console.warn('RNBootSplash is not in this native binary; rebuild the app to hide the native splash.', error?.message);
    }
  }
}

const App = () => {
  const { isDark, colors } = useTheme();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    hideNativeSplash();

    // Session-replay/analytics — inert until a real project ID replaces the
    // placeholder in src/services/config.js (see that file for how to get one).
    if (CLARITY_PROJECT_ID && CLARITY_PROJECT_ID !== 'YOUR_CLARITY_PROJECT_ID') {
      initializeClarity(CLARITY_PROJECT_ID);
    }

    // Must happen before any GoogleSignin.signIn() call (SignInScreen /
    // SignUpScreen's "Continue with Google") — without this, that call
    // fails since the native module has no webClientId configured yet.
    configureGoogleSignIn();

    loadDeals();

    // Re-fetch brands/offers when returning to the app so dashboard logo
    // (and other) edits show up without force-killing the process. Also
    // refresh the FCM token registration — personalized offer alerts only
    // reach devices with an active DeviceToken.device_id, and FCM often
    // invalidates tokens while the app is backgrounded.
    const sub = AppState.addEventListener('change', (next) => {
      const wasBackground = appState.current.match(/inactive|background/);
      appState.current = next;
      if (wasBackground && next === 'active') {
        loadDeals();
        refreshDeviceTokenRegistration();
      }
    });

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
      sub.remove();
      unsubscribeTokenRefresh?.();
      unsubscribePushListeners?.();
    };
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <StatusBar translucent backgroundColor="transparent" barStyle={isDark ? 'light-content' : 'dark-content'} />
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
        <BottomSheetModalProvider>
          <Navigation />
          <AppToast />
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

export default App;
