import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SHADOWS } from '../styles/theme';
import useTheme from '../hooks/useTheme';

/** Shared Skip + primary CTA row used across onboarding steps. */
const OnboardingFooter = ({
  onSkip,
  onContinue,
  continueLabel = 'Continue',
  disabled = false,
  selectedCount,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const showCount = typeof selectedCount === 'number';

  return (
    <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {onSkip ? (
        <Pressable onPress={onSkip} hitSlop={8} style={styles.skipWrap} accessibilityRole="button" accessibilityLabel="Skip">
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onContinue}
        disabled={disabled}
        style={[styles.goBtn, disabled && styles.goBtnDisabled, !onSkip && styles.goBtnFull]}
        accessibilityRole="button"
        accessibilityLabel={continueLabel}
        accessibilityState={{ disabled }}>
        <Text style={styles.goLabel}>{continueLabel}</Text>
        {showCount ? (
          <View style={styles.countPill}>
            <Text style={styles.countLabel}>{selectedCount} selected</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
};

export default OnboardingFooter;

const createStyles = (colors) =>
  StyleSheet.create({
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 24,
      paddingTop: 12,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    skipWrap: {
      paddingVertical: 8,
      paddingHorizontal: 4,
    },
    skip: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    goBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.chip,
      minHeight: 56,
      ...SHADOWS.button,
    },
    goBtnFull: {
      marginLeft: 0,
    },
    goBtnDisabled: {
      opacity: 0.4,
    },
    goLabel: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '800',
    },
    countPill: {
      backgroundColor: 'rgba(255,255,255,0.22)',
      borderRadius: RADIUS.chip,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    countLabel: {
      color: '#FFFFFF',
      fontSize: 12,
      fontWeight: '700',
    },
  });
