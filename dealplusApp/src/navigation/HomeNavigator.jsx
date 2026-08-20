import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COLORS } from '../styles/theme';
import HomeScreen from '../screens/home/HomeScreen';
import SearchScreen from '../screens/home/SearchScreen';
import FavoritesScreen from '../screens/home/FavoritesScreen';

const Tab = createBottomTabNavigator();

function HomeNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopColor: COLORS.border,
        },
        tabBarIcon: ({ color, size }) => {
          const icons = {
            Home: 'home-variant-outline',
            Search: 'magnify',
            Favorites: 'heart-outline',
          };
          return <Icon name={icons[route.name]} color={color} size={size} />;
        },
      })}>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Search" component={SearchScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
    </Tab.Navigator>
  );
}

export default HomeNavigator;
