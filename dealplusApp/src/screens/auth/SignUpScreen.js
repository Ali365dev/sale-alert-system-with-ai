import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { showToast } from '../../utils/CustomToast';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useAuthStore from '../../state/authStore';
import usePreferencesStore from '../../state/preferencesStore';
import { signup, loginWithGoogle } from '../../services/authApi';
import { signInWithGoogle } from '../../services/googleAuth';
import Logo from '../../components/Logo';
import PrimaryButton from '../../components/PrimaryButton';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD_LENGTH = 8;

function FieldInput({ icon, error, colors, styles, rightIcon, onPressRight, ...props }) {
  return (
    <View>
      <View style={[styles.fieldRow, error && styles.fieldRowError]}>
        <Icon name={icon} size={19} color={colors.textSecondary} style={styles.fieldIcon} />
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
            <Icon name={rightIcon} size={19} color={colors.textSecondary} />
          </Pressable>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

function SocialButton({ icon, label, colors, styles, onPress }) {
  return (
    <Pressable style={styles.socialButton} onPress={onPress}>
      <Icon name={icon} size={20} color={colors.text} />
      <Text style={styles.socialButtonLabel}>{label}</Text>
    </Pressable>
  );
}

const SignUpScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setAuth = useAuthStore((state) => state.setAuth);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState(null);

  const validate = () => {
    const next = {};
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address.';
    if (password.length < MIN_PASSWORD_LENGTH) next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    else if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.';
    if (!agreedToTerms) next.terms = 'You must agree to the Terms & Conditions and Privacy Policy.';
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

    const result = await signup({ email: email.trim().toLowerCase(), password, name: name.trim() || undefined });
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
      if (error?.code !== 'SIGN_IN_CANCELLED' && error?.code !== '12501') {
        showToast.error("Couldn't sign in with Google. Please try again.", 'Sign-in failed');
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + SPACING.two, paddingBottom: insets.bottom + SPACING.five }]} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
            <Icon name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Pressable onPress={returnToPreviousScreen} hitSlop={8}>
            <Text style={styles.skipLabel}>Skip</Text>
          </Pressable>
        </View>

        <View style={styles.heroRow}>
          <View style={styles.heroTextWrap}>
            <Logo size={22} />
            <Text style={styles.tagline}>Your Daily Dose of Great Deals</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <View style={styles.heroGlow} />
            <Icon name="sparkles" size={16} color={colors.accent} style={styles.sparkleTopLeft} />
            <View style={styles.giftBadge}>
              <Icon name="gift" size={28} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <Text style={styles.headline}>
          Create{'\n'}
          <Text style={styles.headlineAccent}>Your Account</Text>
        </Text>
        <Text style={styles.subtitle}>Join DealPulse and never miss a great deal again.</Text>

        {formError && (
          <View style={styles.formErrorBox}>
            <Icon name="alert-circle" size={16} color={colors.primary} />
            <Text style={styles.formErrorText}>{formError}</Text>
          </View>
        )}

        <View style={styles.form}>
          <FieldInput icon="person-outline" value={name} onChangeText={setName} placeholder="Full name" colors={colors} styles={styles} />

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

          <FieldInput
            icon="lock-closed-outline"
            value={confirmPassword}
            onChangeText={(v) => {
              setConfirmPassword(v);
              if (errors.confirmPassword) setErrors((e) => ({ ...e, confirmPassword: undefined }));
            }}
            placeholder="Confirm password"
            secureTextEntry={!showConfirmPassword}
            rightIcon={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
            onPressRight={() => setShowConfirmPassword((v) => !v)}
            error={errors.confirmPassword}
            colors={colors}
            styles={styles}
          />

          <View>
            <Pressable
              style={styles.termsRow}
              onPress={() => {
                setAgreedToTerms((v) => !v);
                if (errors.terms) setErrors((e) => ({ ...e, terms: undefined }));
              }}>
              <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                {agreedToTerms && <Icon name="checkmark" size={14} color="#FFFFFF" />}
              </View>
              <Text style={styles.termsLabel}>
                I agree to the{' '}
                <Text style={styles.termsLink} onPress={() => navigation.navigate('TermsConditionsScreen')}>
                  Terms & Conditions
                </Text>{' '}
                and{' '}
                <Text style={styles.termsLink} onPress={() => navigation.navigate('PrivacyPolicyScreen')}>
                  Privacy Policy
                </Text>
              </Text>
            </Pressable>
            {errors.terms && <Text style={styles.errorText}>{errors.terms}</Text>}
          </View>

          <PrimaryButton
            label={submitting ? 'Creating account...' : 'Create Account'}
            icon="arrow-forward"
            pill
            disabled={!email.trim() || !password || !confirmPassword || submitting}
            onPress={handleSubmit}
            style={styles.submitButton}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>OR SIGN UP WITH</Text>
            <View style={styles.dividerLine} />
          </View>

          <SocialButton
            icon="logo-google"
            label={googleSubmitting ? 'Signing in...' : 'Continue with Google'}
            colors={colors}
            styles={styles}
            onPress={handleGoogleSignIn}
          />

          <Pressable onPress={() => navigation.navigate('SignInScreen')} hitSlop={8} style={styles.switchWrap}>
            <Text style={styles.switchLabel}>
              Already have an account? <Text style={styles.switchLink}>Sign In</Text>
            </Text>
          </Pressable>
        </View>

        <View style={styles.banner}>
          <View style={styles.bannerAccentCircle} />
          <Icon name="sparkles" size={13} color={colors.accent} style={styles.bannerSparkle} />
          <Text style={styles.bannerText}>Deals That Make Life Better</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default SignUpScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: {
      paddingHorizontal: SPACING.four,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.four,
    },
    skipLabel: {
      ...TYPOGRAPHY.smallBold,
      color: colors.textSecondary,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: SPACING.five,
    },
    heroTextWrap: {
      gap: 2,
    },
    tagline: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    heroIconWrap: {
      width: 76,
      height: 76,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroGlow: {
      position: 'absolute',
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: colors.errorTint,
    },
    sparkleTopLeft: {
      position: 'absolute',
      top: 2,
      left: 4,
    },
    giftBadge: {
      width: 52,
      height: 52,
      borderRadius: RADIUS.button,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      transform: [{ rotate: '-8deg' }],
      ...SHADOWS.button,
    },
    headline: {
      ...TYPOGRAPHY.title,
      color: colors.text,
    },
    headlineAccent: {
      color: colors.primary,
    },
    subtitle: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      marginTop: SPACING.two,
      marginBottom: SPACING.five,
    },
    formErrorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      backgroundColor: colors.errorTint,
      borderRadius: RADIUS.button,
      padding: SPACING.three,
      marginBottom: SPACING.three,
    },
    formErrorText: {
      ...TYPOGRAPHY.small,
      color: colors.text,
      flex: 1,
    },
    form: {
      gap: SPACING.three,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.button,
      paddingHorizontal: SPACING.three,
      height: 54,
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
      color: colors.text,
      padding: 0,
    },
    errorText: {
      ...TYPOGRAPHY.small,
      color: colors.primary,
      marginTop: SPACING.one,
    },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.two,
    },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    termsLabel: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 20,
    },
    termsLink: {
      color: colors.primary,
      fontWeight: '700',
    },
    submitButton: {
      marginTop: SPACING.two,
      alignSelf: 'stretch',
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.three,
      marginTop: SPACING.two,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerLabel: {
      ...TYPOGRAPHY.small,
      fontSize: 11,
      color: colors.textSecondary,
      letterSpacing: 0.5,
    },
    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.two,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.button,
      height: 52,
    },
    socialButtonLabel: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
    },
    switchWrap: {
      alignItems: 'center',
      marginTop: SPACING.two,
    },
    switchLabel: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    switchLink: {
      color: colors.primary,
      fontWeight: '700',
    },
    banner: {
      minHeight: 84,
      justifyContent: 'center',
      paddingHorizontal: SPACING.four,
      paddingVertical: SPACING.three,
      marginHorizontal: -SPACING.four,
      marginTop: SPACING.four,
      // A solid card with rounded top corners instead of an oversized
      // circle clipped by overflow — that circle-clipping approach kept
      // producing a flat-looking cut at the top regardless of how it was
      // repositioned, since it depends on precise geometry relative to the
      // container's actual rendered size. A plain border-radius on the
      // container itself is correct by construction at any size.
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
