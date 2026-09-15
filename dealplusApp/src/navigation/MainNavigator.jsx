import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { mergedStacks } from './ScreenCollections';
import useOnboardingGateStore from '../state/onboardingGateStore';
import useTheme from '../hooks/useTheme';

const Stack = createNativeStackNavigator();

function MainNavigator() {
  const { colors } = useTheme();
  // MMKV-backed and sync — correct on first paint (no splash gate / route flash).
  const hasOnboarded = useOnboardingGateStore((state) => state.hasOnboarded);

  return (
    <Stack.Navigator
      initialRouteName={hasOnboarded ? 'MainTabs' : 'OnboardingWelcomeScreen'}
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
