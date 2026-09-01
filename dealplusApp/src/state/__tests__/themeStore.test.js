import useThemeStore from '../themeStore';

beforeEach(() => {
  useThemeStore.setState({ isDark: false }, false);
});

test('defaults to light mode', () => {
  expect(useThemeStore.getState().isDark).toBe(false);
});

test('toggleTheme flips light to dark and back', () => {
  useThemeStore.getState().toggleTheme();
  expect(useThemeStore.getState().isDark).toBe(true);
  useThemeStore.getState().toggleTheme();
  expect(useThemeStore.getState().isDark).toBe(false);
});

test('setDark sets an explicit value regardless of the current one', () => {
  useThemeStore.getState().setDark(true);
  expect(useThemeStore.getState().isDark).toBe(true);
  useThemeStore.getState().setDark(true);
  expect(useThemeStore.getState().isDark).toBe(true);
});
