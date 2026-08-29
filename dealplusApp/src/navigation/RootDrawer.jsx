import { createDrawerNavigator } from '@react-navigation/drawer';
import HomeNavigator from './HomeNavigator';
import AppDrawerContent from './AppDrawerContent';
import useTheme from '../hooks/useTheme';

const Drawer = createDrawerNavigator();

/** Wraps the bottom-tab navigator so TopAppBar's menu icon has somewhere to
 * go — quick links to everything otherwise buried a few taps deep in
 * Profile (followed brands/categories, settings, legal), plus a jump back
 * to the Profile tab itself. */
function RootDrawer() {
  const { colors } = useTheme();

  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        overlayColor: 'rgba(0,0,0,0.4)',
        sceneContainerStyle: { backgroundColor: colors.background },
      }}
      drawerContent={(props) => <AppDrawerContent {...props} />}>
      <Drawer.Screen name="Tabs" component={HomeNavigator} />
    </Drawer.Navigator>
  );
}

export default RootDrawer;
