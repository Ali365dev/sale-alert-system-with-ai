import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { mergedStacks } from './ScreenCollections';
import useTheme from '../hooks/useTheme';

const Stack = createNativeStackNavigator();

function MainNavigator() {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      initialRouteName="SplashScreen"
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
