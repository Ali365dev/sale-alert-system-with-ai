/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#171717',
    background: '#FFFFFF',
    backgroundElement: '#F5F5F5',
    backgroundSelected: '#171717',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    primary: '#171717',
    sale: '#E7000B',
    accent: '#FACC15',
    success: '#16A34A',
    onPrimary: '#FFFFFF',
  },
  dark: {
    text: '#171717',
    background: '#FFFFFF',
    backgroundElement: '#F5F5F5',
    backgroundSelected: '#171717',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    primary: '#171717',
    sale: '#E7000B',
    accent: '#FACC15',
    success: '#16A34A',
    onPrimary: '#FFFFFF',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  chip: 999,
  card: 12,
  sheet: 24,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
