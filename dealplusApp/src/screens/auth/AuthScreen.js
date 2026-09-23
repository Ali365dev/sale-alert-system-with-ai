import { useMemo, useRef, useState } from 'react';
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { showToast } from '../../utils/CustomToast';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useAuthStore from '../../state/authStore';
import usePreferencesStore from '../../state/preferencesStore';
import { login, signup, loginWithGoogle } from '../../services/authApi';
import { signInWithGoogle } from '../../services/googleAuth';
import AuthChrome from '../../components/AuthChrome';
import PrimaryButton from '../../components/PrimaryButton';
import GoogleLogo from '../../components/GoogleLogo';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD_LENGTH = 8;

const notifyComingSoon = (feature) => showToast.error(`${feature} isn't available yet.`, 'Coming soon');

function LabeledField({ label, error, colors, styles, rightIcon, onPressRight, ...props }) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldRow, error && styles.fieldRowError]}>
        <TextInput
          placeholderTextColor={colors.textSecondary}
          style={styles.fieldInput}
          autoCorrect={false}
          autoComplete="off"
          spellCheck={false}
          {...props}
        />
        {rightIcon ? (
          <Pressable onPress={onPressRight} hitSlop={8}>
            <Icon name={rightIcon} size={19} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

/**
 * Single auth surface: Create Account / Login switch in place with a slide,
 * instead of navigating between SignInScreen and SignUpScreen.
 */
const AuthScreen = ({ initialMode = 'login' }) => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setAuth = useAuthStore((state) => state.setAuth);

  const [mode, setMode] = useState(initialMode === 'signup' ? 'signup' : 'login');
  const isSignup = mode === 'signup';
  const slideX = useRef(new Animated.Value(0)).current;

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
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const returnToPreviousScreen = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('MainTabs', { screen: 'Profile' });
  };

  const applyAuthResult = (result) => {
    setAuth(result.token, result.user);
    if (result.brands?.length || result.categories?.length) {
      usePreferencesStore.getState().hydrateFromServer(result.brands, result.categories);
    }
    returnToPreviousScreen();
  };

  const switchMode = (next) => {
    if (next === mode) return;
    const goingToSignup = next === 'signup';
    slideX.setValue(goingToSignup ? 56 : -56);
    setMode(next);
    setErrors({});
    setFormError(null);
    Animated.spring(slideX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 9,
      tension: 68,
    }).start();
  };

  const validateSignup = () => {
    const next = {};
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address.';
    if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    } else if (confirmPassword !== password) {
      next.confirmPassword = 'Passwords do not match.';
    }
    if (!agreedToTerms) next.terms = 'You must agree to the Terms & Conditions and Privacy Policy.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const validateLogin = () => {
    const next = {};
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSignup = async () => {
    if (submitting || !validateSignup()) return;
    setSubmitting(true);
    setFormError(null);
    const result = await signup({
      email: email.trim().toLowerCase(),
      password,
      name: name.trim() || undefined,
    });
    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    applyAuthResult(result);
  };

  const handleLogin = async () => {
    if (submitting || !validateLogin()) return;
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
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AuthChrome mode={mode} onSkip={returnToPreviousScreen} onSwitchMode={switchMode}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
          <Animated.View style={{ transform: [{ translateX: slideX }] }}>
            {isSignup ? (
              <>
                <Text style={styles.srOnly}>
                  Create{'\n'}
                  <Text>Your Account</Text>
                </Text>
                <Text style={styles.srOnly}>Join DealPulse and never miss a great deal again.</Text>
              </>
            ) : (
              <>
                <Text style={styles.srOnly}>
                  Welcome <Text>Back!</Text>
                </Text>
                <Text style={styles.srOnly}>
                  Sign in to continue discovering the best deals, discounts and offers.
                </Text>
              </>
            )}

            {formError ? (
              <View style={styles.formErrorBox}>
                <Icon name="alert-circle" size={16} color={colors.primary} />
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            {isSignup ? (
              <LabeledField
                label="Full Name"
                value={name}
                onChangeText={setName}
                placeholder="Full name"
                colors={colors}
                styles={styles}
              />
            ) : null}

            <LabeledField
              label="Email Address"
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
            <LabeledField
              label="Password"
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

            {isSignup ? (
              <>
                <LabeledField
                  label="Confirm Password"
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

                <View style={styles.termsBlock}>
                  <Pressable
                    style={styles.termsRow}
                    onPress={() => {
                      setAgreedToTerms((v) => !v);
                      if (errors.terms) setErrors((e) => ({ ...e, terms: undefined }));
                    }}>
                    <View style={[styles.checkbox, agreedToTerms && styles.checkboxChecked]}>
                      {agreedToTerms ? <Icon name="checkmark" size={14} color="#FFFFFF" /> : null}
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
                  {errors.terms ? <Text style={styles.errorText}>{errors.terms}</Text> : null}
                </View>

                <PrimaryButton
                  label={submitting ? 'Creating account...' : 'Create Account'}
                  pill
                  disabled={!email.trim() || !password || !confirmPassword || submitting}
                  onPress={handleSignup}
                  style={styles.submitButton}
                />
              </>
            ) : (
              <>
                <Pressable onPress={() => notifyComingSoon('Password reset')} hitSlop={8} style={styles.forgotWrap}>
                  <Text style={styles.forgotLabel}>Forgot password?</Text>
                </Pressable>

                <PrimaryButton
                  label={submitting ? 'Signing in...' : 'Sign In'}
                  pill
                  disabled={!email.trim() || !password || submitting}
                  onPress={handleLogin}
                  style={styles.submitButton}
                />
              </>
            )}

            <Pressable style={styles.googleBtn} onPress={handleGoogleSignIn} disabled={googleSubmitting}>
              <GoogleLogo size={20} />
              <Text style={styles.googleLabel}>{googleSubmitting ? 'Signing in...' : 'Continue with Google'}</Text>
            </Pressable>

            <Pressable
              onPress={() => switchMode(isSignup ? 'login' : 'signup')}
              hitSlop={8}
              style={styles.switchWrap}>
              <Text style={styles.switchLabel}>
                {isSignup ? (
                  <>
                    Already have an account? <Text style={styles.switchLink}>Sign In</Text>
                  </>
                ) : (
                  <>
                    Don't have an account? <Text style={styles.switchLink}>Sign Up</Text>
                  </>
                )}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </AuthChrome>
    </KeyboardAvoidingView>
  );
};

export default AuthScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.primary },
    srOnly: { height: 0, width: 0, opacity: 0, overflow: 'hidden' },
    fieldBlock: { marginBottom: 14 },
    fieldLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      height: 52,
      backgroundColor: colors.surface,
    },
    fieldRowError: { borderColor: colors.primary },
    fieldInput: {
      flex: 1,
      alignSelf: 'stretch',
      fontSize: 15,
      fontWeight: '500',
      color: colors.text,
      paddingVertical: 0,
      paddingHorizontal: 0,
      margin: 0,
      ...Platform.select({
        ios: { lineHeight: 18 },
        android: { textAlignVertical: 'center', includeFontPadding: false },
      }),
    },
    errorText: {
      ...TYPOGRAPHY.small,
      fontSize: 12,
      color: colors.primary,
      marginTop: 6,
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
    termsBlock: { marginBottom: 8 },
    termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.two },
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
    termsLink: { color: colors.primary, fontWeight: '700' },
    forgotWrap: { alignItems: 'flex-end', marginBottom: 8 },
    forgotLabel: {
      ...TYPOGRAPHY.smallBold,
      fontSize: 13,
      color: colors.primary,
    },
    submitButton: { alignSelf: 'stretch', marginTop: 8, marginBottom: 12 },
    googleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      height: 52,
      marginBottom: 12,
    },
    googleLabel: {
      ...TYPOGRAPHY.smallBold,
      fontSize: 13,
      color: colors.text,
    },
    switchWrap: { alignItems: 'center', marginBottom: 16 },
    switchLabel: {
      ...TYPOGRAPHY.small,
      fontSize: 13,
      color: colors.textSecondary,
    },
    switchLink: { color: colors.primary, fontWeight: '700' },
  });
