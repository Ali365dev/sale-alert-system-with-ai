import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/home/HomeScreen';
import CouponsScreen from '../screens/home/CouponsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import CustomTabBar from './CustomTabBar';
import useTheme from '../hooks/useTheme';

const Tab = createBottomTabNavigator();

function HomeNavigator() {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, animation: 'shift', sceneContainerStyle: { backgroundColor: colors.background } }}
      tabBar={(props) => <CustomTabBar {...props} />}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Explore" component={CouponsScreen} options={{ title: 'Explore' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

export default HomeNavigator;
