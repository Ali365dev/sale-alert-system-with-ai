import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/home/HomeScreen';
import SearchScreen from '../screens/home/SearchScreen';
import CategoriesScreen from '../screens/categories/CategoriesScreen';
import FavoritesScreen from '../screens/home/FavoritesScreen';
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
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Deals" component={CategoriesScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default HomeNavigator;
