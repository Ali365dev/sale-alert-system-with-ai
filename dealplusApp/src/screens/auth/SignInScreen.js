import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { showToast } from '../../utils/CustomToast';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useAuthStore from '../../state/authStore';
import usePreferencesStore from '../../state/preferencesStore';
import { login, loginWithGoogle } from '../../services/authApi';
import { signInWithGoogle } from '../../services/googleAuth';
import Logo from '../../components/Logo';
import PrimaryButton from '../../components/PrimaryButton';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const notifyComingSoon = (feature) => showToast.error(`${feature} isn't available yet.`, 'Coming soon');

function FieldInput({ icon, error, colors, styles, rightIcon, onPressRight, ...props }) {
  return (
    <View>
      <View style={[styles.fieldRow, error && styles.fieldRowError]}>
        <Icon name={icon} size={18} color={colors.textSecondary} style={styles.fieldIcon} />
        <TextInput
          placeholderTextColor={colors.textSecondary}
          style={styles.fieldInput}
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          {...props}
        />
        {rightIcon && (
          <Pressable onPress={onPressRight} hitSlop={8}>
            <Icon name={rightIcon} size={18} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

function SocialButton({ icon, label, color, colors, styles, onPress }) {
  return (
    <Pressable style={styles.socialButton} onPress={onPress}>
      <Icon name={icon} size={18} color={color ?? colors.text} />
      <Text style={styles.socialButtonLabel}>{label}</Text>
    </Pressable>
  );
}

const SignInScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const validate = () => {
    const next = {};
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const returnToPreviousScreen = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs', { screen: 'Tabs', params: { screen: 'Profile' } });
  };

  const handleSubmit = async () => {
    if (submitting || !validate()) return;
    setSubmitting(true);
    setFormError(null);

    const result = await login({ email: email.trim().toLowerCase(), password });
    setSubmitting(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    applyAuthResult(result);
  };

  const applyAuthResult = (result) => {
    setAuth(result.token, result.user);
    if (result.brands?.length || result.categories?.length) {
      usePreferencesStore.getState().hydrateFromServer(result.brands, result.categories);
    }
    returnToPreviousScreen();
  };

  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const handleGoogleSignIn = async () => {
    if (googleSubmitting) return;
    setGoogleSubmitting(true);
    setFormError(null);
    try {
      const idToken = await signInWithGoogle();
      const result = await loginWithGoogle(idToken);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      applyAuthResult(result);
    } catch (error) {
      // A user-cancelled picker isn't an error worth surfacing.
      if (error?.code !== 'SIGN_IN_CANCELLED' && error?.code !== '12501') {
        showToast.error("Couldn't sign in with Google. Please try again.", 'Sign-in failed');
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* No ScrollView — every section below is sized to fit one screen. The
          flex-1 spacer between the form and the banner absorbs any extra
          room on a taller device and shrinks to 0 on a shorter one, so the
          banner always lands directly under the content instead of either
          floating with a huge gap or needing to scroll into view. */}
      <View style={[styles.body, { paddingTop: insets.top + SPACING.two }]}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Icon name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Pressable onPress={returnToPreviousScreen} hitSlop={8}>
            <Text style={styles.skipLabel}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.heroTextWrap}>
            <Logo size={20} />
            <Text style={styles.tagline}>Your Daily Dose of Great Deals</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <View style={styles.heroGlow} />
            <Icon name="sparkles" size={14} color={colors.accent} style={styles.sparkleTopLeft} />
            <Icon name="sparkles" size={10} color={colors.accent} style={styles.sparkleBottomRight} />
            <View style={styles.tagBadge}>
              <Icon name="pricetag" size={24} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <Text style={styles.headline}>
          Welcome <Text style={styles.headlineAccent}>Back!</Text>
        </Text>
        <Text style={styles.subtitle}>Sign in to continue discovering the best deals, discounts and offers.</Text>

        {formError && (
          <View style={styles.formErrorBox}>
            <Icon name="alert-circle" size={15} color={colors.primary} />
            <Text style={styles.formErrorText}>{formError}</Text>
          </View>
        )}

        <View style={styles.form}>
          <FieldInput
            icon="mail-outline"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
            }}
            placeholder="Email address"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
            colors={colors}
            styles={styles}
          />

          <FieldInput
            icon="lock-closed-outline"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
            }}
            placeholder="Password"
            secureTextEntry={!showPassword}
            rightIcon={showPassword ? 'eye-off-outline' : 'eye-outline'}
            onPressRight={() => setShowPassword((v) => !v)}
            error={errors.password}
            colors={colors}
            styles={styles}
          />

          <Pressable onPress={() => notifyComingSoon('Password reset')} hitSlop={8} style={styles.forgotWrap}>
            <Text style={styles.forgotLabel}>Forgot password?</Text>
          </Pressable>

          <PrimaryButton
            label={submitting ? 'Signing in...' : 'Sign In'}
            icon="arrow-forward"
            pill
            disabled={!email.trim() || !password || submitting}
            onPress={handleSubmit}
            style={styles.submitButton}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>OR CONTINUE WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.socialRow}>
            <SocialButton
              icon="logo-google"
              label={googleSubmitting ? 'Signing in...' : 'Continue with Google'}
              colors={colors}
              styles={styles}
              onPress={handleGoogleSignIn}
            />
          </View>

          <Pressable onPress={() => navigation.navigate('SignUpScreen')} hitSlop={8} style={styles.switchWrap}>
            <Text style={styles.switchLabel}>
              Don't have an account? <Text style={styles.switchLink}>Sign Up</Text>
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.banner, { paddingBottom: insets.bottom }]} pointerEvents="none">
        <View style={styles.bannerAccentCircle} />
        <Icon name="sparkles" size={13} color={colors.accent} style={styles.bannerSparkle} />
        <Text style={styles.bannerText}>Deals That Make Life Better</Text>
      </View>
    </KeyboardAvoidingView>
    
  );
};

export default SignInScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    body: {
      flex: 1,
      paddingHorizontal: SPACING.four,
      // The banner below is now position: absolute (pinned to the exact
      // screen bottom) instead of sitting in normal flow — this reserves
      // just enough clearance so it can never cover the last form content,
      // without reintroducing the old huge-gap-in-the-middle look a full
      // flex spacer caused.
      paddingBottom: 100,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.two,
    },
    skipLabel: {
      ...TYPOGRAPHY.smallBold,
      color: colors.textSecondary,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: SPACING.three,
    },
    heroTextWrap: {
      gap: 2,
    },
    tagline: {
      ...TYPOGRAPHY.small,
      fontSize: 12,
      color: colors.textSecondary,
    },
    heroIconWrap: {
      width: 60,
      height: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroGlow: {
      position: 'absolute',
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.errorTint,
    },
    sparkleTopLeft: {
      position: 'absolute',
      top: 0,
      left: 2,
    },
    sparkleBottomRight: {
      position: 'absolute',
      bottom: 4,
      right: 4,
    },
    tagBadge: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.button,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ rotate: '-10deg' }],
      ...SHADOWS.button,
    },
    headline: {
      ...TYPOGRAPHY.headline,
      fontSize: 28,
      lineHeight: 32,
      color: colors.text,
    },
    headlineAccent: {
      color: colors.primary,
    },
    subtitle: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
      marginTop: SPACING.one,
      marginBottom: SPACING.three,
    },
    formErrorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      backgroundColor: colors.errorTint,
      borderRadius: RADIUS.button,
      padding: SPACING.two,
      marginBottom: SPACING.two,
    },
    formErrorText: {
      ...TYPOGRAPHY.small,
      color: colors.text,
      flex: 1,
    },
    form: {
      gap: SPACING.two,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.button,
      paddingHorizontal: SPACING.three,
      height: 48,
    },
    fieldRowError: {
      borderColor: colors.primary,
    },
    fieldIcon: {
      flexGrow: 0,
      flexShrink: 0,
    },
    fieldInput: {
      flex: 1,
      ...TYPOGRAPHY.default,
      fontSize: 15,
      color: colors.text,
      padding: 0,
    },
    errorText: {
      ...TYPOGRAPHY.small,
      fontSize: 12,
      color: colors.primary,
      marginTop: 2,
    },
    forgotWrap: {
      alignItems: 'flex-end',
    },
    forgotLabel: {
      ...TYPOGRAPHY.smallBold,
      fontSize: 13,
      color: colors.primary,
    },
    submitButton: {
      alignSelf: 'stretch',
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerLabel: {
      ...TYPOGRAPHY.small,
      fontSize: 10,
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    socialRow: {
      gap: SPACING.two,
    },
    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.two,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.button,
      height: 44,
    },
    socialButtonLabel: {
      ...TYPOGRAPHY.smallBold,
      fontSize: 13,
      color: colors.text,
    },
    switchWrap: {
      alignItems: 'center',
    },
    switchLabel: {
      ...TYPOGRAPHY.small,
      fontSize: 13,
      color: colors.textSecondary,
    },
    switchLink: {
      color: colors.primary,
      fontWeight: '700',
    },
    banner: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      minHeight: 84,
      zIndex: 331,
      justifyContent: 'center',
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.three,
      // A solid card with rounded top corners instead of an oversized
      // circle clipped by overflow — that circle-clipping approach kept
      // producing a flat-looking cut at the top no matter how it was
      // repositioned (it depends on precise geometry relative to the
      // container's actual rendered size, which isn't something to get
      // right by guessing without seeing it render). A plain border-radius
      // on the container itself is correct by construction at any size.
      backgroundColor: colors.primary,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      overflow: 'hidden',
    },
    bannerAccentCircle: {
      position: 'absolute',
      top: -30,
      right: -30,
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: 'rgba(255,255,255,0.08)',
    },
    bannerSparkle: {
      position: 'absolute',
      top: 12,
      left: SPACING.four + 60,
    },
    bannerText: {
      ...TYPOGRAPHY.headline,
      fontSize: 19,
      lineHeight: 23,
      color: '#FFFFFF',
      maxWidth: 200,
    },
  });
