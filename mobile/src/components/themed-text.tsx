import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'headline'
    | 'subtitle'
    | 'small'
    | 'smallBold'
    | 'label'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'headline' && styles.headline,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'label' && styles.label,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Montserrat_400Regular',
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Montserrat_700Bold',
  },
  default: {
    fontSize: 16,
    lineHeight: 24,
    fontFamily: 'Montserrat_500Medium',
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Montserrat_700Bold',
    letterSpacing: 0.2,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Montserrat_800ExtraBold',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  headline: {
    fontSize: 22,
    fontFamily: 'Montserrat_800ExtraBold',
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: 'Montserrat_700Bold',
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
    fontFamily: 'Montserrat_500Medium',
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    fontFamily: 'Montserrat_700Bold',
    color: '#171717',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
