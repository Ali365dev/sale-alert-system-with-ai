import { NavigationContainer } from '@react-navigation/native';

import { MainNavigator } from './MainNavigator';

export function Navigation() {
  return (
    <NavigationContainer>
      <MainNavigator />
    </NavigationContainer>
  );
}
