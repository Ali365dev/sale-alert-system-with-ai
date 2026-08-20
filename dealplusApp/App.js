import { Platform, StatusBar } from 'react-native';
import React, { useEffect } from 'react';
import Navigation from './src/navigation/Navigation';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';
import { toastConfig } from './src/utils/CustomToast';
import { loadDeals } from './src/services/dealsService';

const App = () => {
  useEffect(() => {
    loadDeals();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar
        translucent={Platform.OS === 'ios'}
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Navigation />
        <Toast config={toastConfig} position="top" />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
};

export default App;
