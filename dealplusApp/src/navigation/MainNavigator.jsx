import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { mergedStacks } from './ScreenCollections';
import useOnboardingGateStore from '../state/onboardingGateStore';
import useAuthStore from '../state/authStore';
import { Storage } from '../state/storage';
import useTheme from '../hooks/useTheme';

const Stack = createNativeStackNavigator();

/** Sync read of the persisted JWT so cold start doesn't flash MainTabs as a
 * guest while zustand persist rehydrates asynchronously. */
const readPersistedAuthToken = () => {
  try {
    const raw = Storage.getString('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token || null;
  } catch {
    return null;
  }
};

const resolveInitialRoute = (hasOnboarded, token) => {
  if (!hasOnboarded) return 'OnboardingWelcomeScreen';
  if (!token) return 'SignInScreen';
  return 'MainTabs';
};

function MainNavigator() {
  const { colors } = useTheme();
  // MMKV-backed and sync — correct on first paint (no splash gate / route flash).
  const hasOnboarded = useOnboardingGateStore((state) => state.hasOnboarded);
  const liveToken = useAuthStore((state) => state.token);
  const token = liveToken ?? readPersistedAuthToken();
  const initialRouteName = resolveInitialRoute(hasOnboarded, token);

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={() => ({
        headerShown: false,
        headerBackButtonDisplayMode: 'minimal',
        headerBackTitleVisible: false,
        contentStyle: { backgroundColor: colors.background },
      })}>
      {mergedStacks.map((item, index) => (
        <Stack.Screen
          options={{ headerShown: false, headerBackTitleVisible: false, ...item.options }}
          key={index}
          name={item.name}
          component={item.component}
        />
      ))}
    </Stack.Navigator>
  );
}

export default MainNavigator;
