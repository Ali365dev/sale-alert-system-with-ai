import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { PrimaryButton } from './primary-button';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  ctaLabel?: string;
  onPressCta?: () => void;
  variant?: 'empty' | 'error';
}

const TONE = {
  empty: { bg: '#F5F5F5', fg: '#B7131A' },
  error: { bg: '#FBDCDC', fg: '#B7131A' },
} as const;

export function EmptyState({ icon, title, body, ctaLabel, onPressCta, variant = 'empty' }: Props) {
  const tone = TONE[variant];
  const breathe = useSharedValue(1);

  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.06, { duration: 1400 }),
        withTiming(1, { duration: 1400 })
      ),
      -1,
      true
    );
  }, [breathe]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.duration(420).springify().damping(16)} style={styles.container}>
      <Animated.View style={[styles.iconCircle, { backgroundColor: tone.bg }, iconStyle]}>
        <Ionicons name={icon} size={32} color={tone.fg} />
      </Animated.View>
      <ThemedText type="headline" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
        {body}
      </ThemedText>
      {ctaLabel && <PrimaryButton label={ctaLabel} onPress={onPressCta} style={styles.cta} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.six,
    gap: Spacing.two,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  title: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  cta: {
    marginTop: Spacing.three,
    minWidth: 180,
  },
});
