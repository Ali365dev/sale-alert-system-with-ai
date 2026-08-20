import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import { AlertsScreen } from '../screens/alerts/AlertsScreen';
import { HomeScreen } from '../screens/home/HomeScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { colors } from '../styles/theme';
import { Tabs } from './ScreenCollections';

export type AppTabsParamList = {
  [Tabs.Home]: undefined;
  [Tabs.Alerts]: undefined;
  [Tabs.Profile]: undefined;
};

const Tab = createBottomTabNavigator<AppTabsParamList>();

export function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tab.Screen name={Tabs.Home} component={HomeScreen} />
      <Tab.Screen name={Tabs.Alerts} component={AlertsScreen} />
      <Tab.Screen name={Tabs.Profile} component={ProfileScreen} />
    </Tab.Navigator>
  );
}
