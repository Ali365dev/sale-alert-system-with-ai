import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import { forgotPassword, resetPassword } from '../../services/authApi';
import { showSuccessToast } from '../../utils/CustomToast';

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD_LENGTH = 8;

const ForgotPasswordScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [step, setStep] = useState('request'); // request | reset
  const [email, setEmail] = useState(route.params?.email || '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  const onSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('Enter a valid email address.');
      return;
    }
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      const result = await forgotPassword({ email: trimmed });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEmail(trimmed);
      setInfo(result.message || 'If an account exists, we sent a reset code.');
      if (result.dev_code) {
        setCode(String(result.dev_code));
        setInfo(`${result.message || 'Code sent.'} Dev code: ${result.dev_code}`);
      }
      setStep('reset');
    } finally {
      setSubmitting(false);
    }
  };

  const onReset = async () => {
    if (!code.trim()) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await resetPassword({
        email: email.trim().toLowerCase(),
        code: code.trim(),
        password,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      showSuccessToast(result.message || 'Password updated. Sign in with your new password.');
      navigation.navigate('SignInScreen');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Forgot Password" showBack hideProfile />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 8}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>
            {step === 'request' ? 'Reset your password' : 'Enter code & new password'}
          </Text>
          <Text style={styles.sub}>
            {step === 'request'
              ? "We'll email a 6-digit code to your account if it uses email and password."
              : `Enter the code we sent to ${email}, then choose a new password.`}
          </Text>

          {error ? (
            <View style={styles.bannerError}>
              <Icon name="alert-circle" size={18} color={colors.primary} />
              <Text style={styles.bannerText}>{error}</Text>
            </View>
          ) : null}
          {info ? (
            <View style={styles.bannerInfo}>
              <Icon name="mail-outline" size={18} color={colors.primary} />
              <Text style={styles.bannerText}>{info}</Text>
            </View>
          ) : null}

          {step === 'request' ? (
            <>
              <Text style={styles.label}>Email</Text>
              <View style={styles.fieldRow}>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                />
              </View>
              <PrimaryButton
                label={submitting ? 'Sending…' : 'Send reset code'}
                pill
                disabled={!email.trim() || submitting}
                onPress={onSendCode}
                style={styles.submit}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Reset code</Text>
              <View style={styles.fieldRow}>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  placeholder="6-digit code"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  keyboardType="number-pad"
                  maxLength={6}
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                />
              </View>

              <Text style={styles.label}>New password</Text>
              <View style={styles.fieldRow}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="New password"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Icon
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={19}
                    color={colors.textSecondary}
                  />
                </Pressable>
              </View>

              <Text style={styles.label}>Confirm password</Text>
              <View style={styles.fieldRow}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  placeholderTextColor={colors.textSecondary}
                  style={styles.input}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="new-password"
                />
              </View>

              <PrimaryButton
                label={submitting ? 'Updating…' : 'Update password'}
                pill
                disabled={!code.trim() || !password || !confirmPassword || submitting}
                onPress={onReset}
                style={styles.submit}
              />

              <Pressable
                onPress={() => {
                  if (submitting) return;
                  onSendCode();
                }}
                hitSlop={8}
                style={styles.resendWrap}>
                <Text style={styles.resend}>Resend code</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setStep('request');
                  setError(null);
                  setInfo(null);
                }}
                hitSlop={8}
                style={styles.resendWrap}>
                <Text style={styles.changeEmail}>Use a different email</Text>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

export default ForgotPasswordScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    body: {
      paddingHorizontal: SPACING.four,
      paddingBottom: SPACING.eight,
      paddingTop: SPACING.two,
    },
    heading: {
      ...TYPOGRAPHY.h2,
      color: colors.text,
      marginBottom: SPACING.two,
    },
    sub: {
      ...TYPOGRAPHY.body,
      color: colors.textSecondary,
      marginBottom: SPACING.four,
      lineHeight: 22,
    },
    label: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
      marginBottom: 8,
      marginTop: SPACING.two,
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.button,
      paddingHorizontal: SPACING.three,
      minHeight: 52,
      backgroundColor: colors.surface,
      marginBottom: SPACING.two,
    },
    input: {
      flex: 1,
      ...TYPOGRAPHY.body,
      color: colors.text,
      paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    },
    submit: { alignSelf: 'stretch', marginTop: SPACING.four },
    bannerError: {
      flexDirection: 'row',
      gap: SPACING.two,
      alignItems: 'center',
      backgroundColor: colors.errorTint,
      borderRadius: RADIUS.button,
      padding: SPACING.three,
      marginBottom: SPACING.three,
    },
    bannerInfo: {
      flexDirection: 'row',
      gap: SPACING.two,
      alignItems: 'center',
      backgroundColor: colors.backgroundElement,
      borderRadius: RADIUS.button,
      padding: SPACING.three,
      marginBottom: SPACING.three,
    },
    bannerText: {
      ...TYPOGRAPHY.small,
      color: colors.text,
      flex: 1,
      lineHeight: 18,
    },
    resendWrap: { alignItems: 'center', marginTop: SPACING.three },
    resend: { ...TYPOGRAPHY.smallBold, color: colors.primary },
    changeEmail: { ...TYPOGRAPHY.small, color: colors.textSecondary },
  });
