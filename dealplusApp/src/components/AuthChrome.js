import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SHADOWS, SPACING } from '../styles/theme';
import useTheme from '../hooks/useTheme';

/** Red hero + overlapping white sheet used by Sign In / Sign Up. */
const AuthChrome = ({ mode, onSkip, onSwitchMode, children }) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isSignup = mode === 'signup';

  return (
    <View style={styles.root}>
      <View style={[styles.hero, { paddingTop: insets.top + SPACING.two }]}>
        <View style={styles.heroTop}>
          <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button" accessibilityLabel="Skip">
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.logoMark}>
          <Icon name="pricetag" size={28} color={colors.primary} />
          <Icon name="pulse" size={14} color={colors.primary} style={styles.logoPulse} />
        </View>
        <Text style={styles.welcome}>Welcome to DealPulse</Text>
        <Text style={styles.heroSub}>
          Enter your email or phone number to find exclusive deals & savings.
        </Text>
      </View>

      <View style={styles.sheet}>
        <View style={styles.segment}>
          <Pressable
            onPress={() => onSwitchMode('signup')}
            style={[styles.segmentBtn, isSignup && styles.segmentBtnActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSignup }}>
            <Text style={[styles.segmentLabel, isSignup && styles.segmentLabelActive]}>Create Account</Text>
          </Pressable>
          <Pressable
            onPress={() => onSwitchMode('login')}
            style={[styles.segmentBtn, !isSignup && styles.segmentBtnActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: !isSignup }}>
            <Text style={[styles.segmentLabel, !isSignup && styles.segmentLabelActive]}>Login</Text>
          </Pressable>
        </View>
        {children}
      </View>
    </View>
  );
};

export default AuthChrome;

const createStyles = (colors) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.primary,
    },
    hero: {
      paddingHorizontal: 24,
      paddingBottom: 48,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      marginBottom: 28,
    },
    skip: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 0.4,
    },
    logoMark: {
      width: 64,
      height: 64,
      borderRadius: 18,
      backgroundColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: 18,
      ...SHADOWS.card,
    },
    logoPulse: {
      position: 'absolute',
      bottom: 12,
      right: 12,
    },
    welcome: {
      color: '#FFFFFF',
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: -0.4,
      marginBottom: 8,
    },
    heroSub: {
      color: 'rgba(255,255,255,0.88)',
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
      textAlign: 'center',
      paddingHorizontal: 12,
    },
    sheet: {
      flex: 1,
      marginTop: -28,
      backgroundColor: colors.surface,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 24,
      paddingTop: 22,
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundElement,
      borderRadius: RADIUS.chip,
      padding: 4,
      marginBottom: 22,
    },
    segmentBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: RADIUS.chip,
    },
    segmentBtnActive: {
      backgroundColor: colors.surface,
      ...SHADOWS.card,
    },
    segmentLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    segmentLabelActive: {
      color: colors.primary,
    },
  });
