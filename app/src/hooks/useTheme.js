import { useMemo } from 'react';
import useThemeStore from '../state/themeStore';
import { DARK_COLORS, LIGHT_COLORS } from '../styles/theme';

/** Reactive theme access — `colors` swaps between LIGHT_COLORS/DARK_COLORS as
 * the persisted toggle changes. Pair with a per-component `createStyles(colors)`
 * function and `useMemo(() => createStyles(colors), [colors])`, since
 * StyleSheet.create output is otherwise frozen at module-load time and won't
 * react to theme changes on its own. */
const useTheme = () => {
  const isDark = useThemeStore((state) => state.isDark);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const setDark = useThemeStore((state) => state.setDark);
  const colors = useMemo(() => (isDark ? DARK_COLORS : LIGHT_COLORS), [isDark]);

  return { colors, isDark, toggleTheme, setDark };
};

export default useTheme;
