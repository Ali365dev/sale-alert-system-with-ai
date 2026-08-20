import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { BrandDetailScreen } from '../screens/deals/BrandDetailScreen';
import { DealDetailScreen } from '../screens/deals/DealDetailScreen';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen';
import { AppTabs } from './AppTabs';
import { Screens } from './ScreenCollections';

export type MainStackParamList = {
  [Screens.Onboarding]: undefined;
  [Screens.MainTabs]: undefined;
  [Screens.DealDetail]: { dealId: string };
  [Screens.BrandDetail]: { brandId: string };
};

const Stack = createNativeStackNavigator<MainStackParamList>();

export function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name={Screens.Onboarding} component={OnboardingScreen} />
      <Stack.Screen name={Screens.MainTabs} component={AppTabs} />
      <Stack.Screen name={Screens.DealDetail} component={DealDetailScreen} options={{ headerShown: true }} />
      <Stack.Screen name={Screens.BrandDetail} component={BrandDetailScreen} options={{ headerShown: true }} />
    </Stack.Navigator>
  );
}
