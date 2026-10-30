import { useEffect, useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import PrimaryButton from './PrimaryButton';

const EmptyState = ({ icon, title, body, ctaLabel, onPressCta, variant = 'empty' }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tone = variant === 'error' ? { bg: colors.errorTint, fg: colors.primary } : { bg: colors.backgroundElement, fg: colors.primary };
  const breathe = useSharedValue(1);

  useEffect(() => {
    breathe.value = withRepeat(withSequence(withTiming(1.06, { duration: 1400 }), withTiming(1, { duration: 1400 })), -1, true);
  }, [breathe]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  return (
    <Animated.View entering={FadeInDown.duration(420).springify().damping(16)} style={styles.container}>
      <Animated.View style={[styles.iconCircle, { backgroundColor: tone.bg }, iconStyle]}>
        <Icon name={icon} size={32} color={tone.fg} />
      </Animated.View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {ctaLabel && <PrimaryButton label={ctaLabel} onPress={onPressCta} style={styles.cta} />}
    </Animated.View>
  );
};

export default EmptyState;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingHorizontal: SPACING.five,
      paddingVertical: SPACING.six,
      gap: SPACING.two,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.two,
    },
    title: {
      ...TYPOGRAPHY.headline,
      color: colors.text,
      textAlign: 'center',
    },
    body: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    cta: {
      marginTop: SPACING.three,
      minWidth: 180,
    },
  });
