/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

// Matched against the actual Stitch renders (projects/13779227750844170711),
// not the original written brief — Stitch's own output uses a deep red as the
// primary/action color throughout (buttons, active nav, wordmark, links),
// with black reserved for headline/body text and a brighter red + yellow for badges.
export const Colors = {
  light: {
    text: '#171717',
    background: '#FFFFFF',
    backgroundElement: '#F8F9FB',
    backgroundSelected: '#B7131A',
    textSecondary: '#6B7280',
    border: '#F0DADA',
    primary: '#B7131A',
    sale: '#DB322F',
    accent: '#F5CB1B',
    success: '#16A34A',
    onPrimary: '#FFFFFF',
  },
  dark: {
    text: '#171717',
    background: '#FFFFFF',
    backgroundElement: '#F8F9FB',
    backgroundSelected: '#B7131A',
    textSecondary: '#6B7280',
    border: '#F0DADA',
    primary: '#B7131A',
    sale: '#DB322F',
    accent: '#F5CB1B',
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
  card: 16,
  button: 14,
  sheet: 24,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
