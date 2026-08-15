import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_700Bold,
  Montserrat_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/montserrat';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/splash-screen';
import { AlertsProvider } from '@/state/alerts';
import { DataProvider } from '@/state/data';
import { FavoritesProvider } from '@/state/favorites';
import { OnboardingGateProvider, useOnboardingGate } from '@/state/onboarding-gate';
import { PreferencesProvider } from '@/state/preferences';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <OnboardingGateProvider>
        <DataProvider>
          <FavoritesProvider>
            <AlertsProvider>
              <PreferencesProvider>
                <AnimatedSplashOverlay />
                <RootNavigator />
              </PreferencesProvider>
            </AlertsProvider>
          </FavoritesProvider>
        </DataProvider>
      </OnboardingGateProvider>
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { hasOnboarded } = useOnboardingGate();

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!hasOnboarded}>
        <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={hasOnboarded}>
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="deal/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="brand/index" options={{ presentation: 'card' }} />
        <Stack.Screen name="brand/[id]" options={{ presentation: 'card' }} />
        <Stack.Screen name="search" options={{ presentation: 'card' }} />
        <Stack.Screen name="notifications" options={{ presentation: 'card' }} />
        <Stack.Screen name="create-alert" options={{ presentation: 'card' }} />
        <Stack.Screen name="privacy" options={{ presentation: 'card' }} />
      </Stack.Protected>
    </Stack>
  );
}
