import { useMemo } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import MainNavigator from './MainNavigator';
import { navigationRef } from '../utils/NavigationUtil';
import useTheme from '../hooks/useTheme';

const Navigation = () => {
  const { colors, isDark } = useTheme();

  // React Navigation defaults its own screen/scene backgrounds (used by
  // native-stack's contentStyle and bottom-tabs' sceneContainerStyle) to
  // white unless a theme is supplied here — without this, dark mode shows a
  // white flash/strip in any gap not covered by a screen's own View (e.g.
  // behind the floating tab bar).
  const navTheme = useMemo(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
      },
    };
  }, [isDark, colors]);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <MainNavigator />
    </NavigationContainer>
  );
};

export default Navigation;
