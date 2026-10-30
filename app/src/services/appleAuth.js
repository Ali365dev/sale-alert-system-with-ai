import auth from '@react-native-firebase/auth';
import { NativeModules, Platform } from 'react-native';

const NATIVE_MODULE_NAME = 'RNAppleAuthModule';

/** True when the native Apple Auth module is linked and the OS supports it (iOS 13+). */
export const isAppleSignInAvailable = () => {
  if (Platform.OS !== 'ios' && process.env.NODE_ENV !== 'test') return false;
  if (process.env.NODE_ENV === 'test') return true;
  try {
    if (!NativeModules[NATIVE_MODULE_NAME]) return false;
    const { appleAuth } = require('@invertase/react-native-apple-authentication');
    return Boolean(appleAuth?.isSupported);
  } catch {
    return false;
  }
};

const loadAppleAuth = () => {
  if (Platform.OS !== 'ios' && process.env.NODE_ENV !== 'test') return null;
  try {
    return require('@invertase/react-native-apple-authentication');
  } catch (error) {
    if (__DEV__) {
      console.warn(
        'Apple Sign-In native module is missing. Rebuild iOS after `pod install` so RNAppleAuthModule is in the binary.',
        error?.message,
      );
    }
    return null;
  }
};

/** Display name from Apple's one-time fullName payload (only on first authorize). */
export const formatAppleFullName = (fullName) => {
  if (!fullName || typeof fullName !== 'object') return undefined;
  const parts = [fullName.givenName, fullName.familyName].filter(
    (p) => typeof p === 'string' && p.trim(),
  );
  return parts.length ? parts.join(' ').trim() : undefined;
};

/**
 * Native Apple sheet → Firebase Apple credential → Firebase ID token for
 * POST /auth/apple (same Firebase-verify path as Google). Returns
 * `{ idToken, name? }`. Cancellation uses `.code === 'SIGN_IN_CANCELLED'`.
 */
export const signInWithApple = async () => {
  const mod = loadAppleAuth();
  if (!mod?.appleAuth) {
    const missing = new Error(
      'Apple Sign-In is not in this app binary. Rebuild iOS: `cd ios && pod install && cd .. && npx react-native run-ios`.',
    );
    missing.code = 'NATIVE_MODULE_MISSING';
    throw missing;
  }

  const { appleAuth } = mod;
  if (!appleAuth.isSupported) {
    const unsupported = new Error('Sign in with Apple requires iOS 13 or later.');
    unsupported.code = 'NOT_SUPPORTED';
    throw unsupported;
  }

  let response;
  try {
    response = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });
  } catch (error) {
    if (String(error?.code) === appleAuth.Error.CANCELED || error?.code === '1001') {
      const cancelled = new Error('Apple sign-in was cancelled.');
      cancelled.code = 'SIGN_IN_CANCELLED';
      throw cancelled;
    }
    throw error;
  }

  if (!response?.identityToken) {
    throw new Error(
      'Apple did not return an identity token. Enable the Apple provider in Firebase Auth and add the Sign in with Apple capability in Xcode.',
    );
  }

  const { identityToken, nonce } = response;
  const credential = auth.AppleAuthProvider.credential(identityToken, nonce);
  const userCredential = await auth().signInWithCredential(credential);
  const idToken = await userCredential.user.getIdToken();
  const name = formatAppleFullName(response.fullName);

  return { idToken, name };
};
