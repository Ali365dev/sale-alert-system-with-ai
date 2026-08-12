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

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { DataProvider } from '@/state/data';
import { FavoritesProvider } from '@/state/favorites';
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
      <DataProvider>
        <FavoritesProvider>
          <PreferencesProvider>
            <AnimatedSplashOverlay />
            <Stack
              initialRouteName="onboarding"
              screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
              <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
              <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
              <Stack.Screen name="deal/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="brand/index" options={{ presentation: 'card' }} />
              <Stack.Screen name="brand/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="search" options={{ presentation: 'card' }} />
            </Stack>
          </PreferencesProvider>
        </FavoritesProvider>
      </DataProvider>
    </ThemeProvider>
  );
}
