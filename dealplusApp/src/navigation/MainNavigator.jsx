import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { mergedStacks } from './ScreenCollections';

const Stack = createNativeStackNavigator();

function MainNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="MainTabs"
      screenOptions={() => ({
        headerShown: false,
        headerBackButtonDisplayMode: 'minimal',
        headerBackTitleVisible: false,
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
