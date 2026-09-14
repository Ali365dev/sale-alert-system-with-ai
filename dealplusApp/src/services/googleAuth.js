import auth from '@react-native-firebase/auth';
import { GOOGLE_WEB_CLIENT_ID } from './config';
import { hasTurboModule, shouldLoadNativePackage } from '../utils/turboModules';

const NATIVE_MODULE_NAME = 'RNGoogleSignin';

export const isGoogleSignInNativeAvailable = () => hasTurboModule(NATIVE_MODULE_NAME);

const loadGoogleSignin = () => {
  if (!shouldLoadNativePackage(NATIVE_MODULE_NAME)) {
    return null;
  }
  try {
    return require('@react-native-google-signin/google-signin').GoogleSignin;
  } catch (error) {
    if (__DEV__) {
      console.warn(
        'Google Sign-In native module is missing. Rebuild the iOS/Android app after `pod install` / Gradle so RNGoogleSignin is in the binary.',
        error?.message,
      );
    }
    return null;
  }
};

/** Call once at app startup (see App.js) — no-op until a real
 * GOOGLE_WEB_CLIENT_ID replaces the placeholder in src/services/config.js
 * (see that file for where to get one, once Google sign-in is enabled in
 * the Firebase console). Also a no-op if the native module is not linked. */
export const configureGoogleSignIn = () => {
  if (!GOOGLE_WEB_CLIENT_ID) return;
  const GoogleSignin = loadGoogleSignin();
  if (!GoogleSignin) return;
  GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID });
};

/** Runs the native Google account picker, then exchanges the resulting
 * Google credential for a Firebase session — the backend verifies the
 * *Firebase* ID token this returns (services/firebase_auth.py), never a raw
 * Google token, so the whole app only ever has one token-verification path
 * regardless of sign-in provider. Throws on cancellation or failure (a
 * cancellation always has `.code === 'SIGN_IN_CANCELLED'`); callers should
 * catch and show an error rather than treat every rejection as fatal. */
export const signInWithGoogle = async () => {
  const GoogleSignin = loadGoogleSignin();
  if (!GoogleSignin) {
    const missing = new Error(
      'Google Sign-In is not in this app binary. Stop Metro, then rebuild: iOS `cd ios && pod install && cd .. && npx react-native run-ios`, Android `npx react-native run-android`. Reloading JS is not enough.',
    );
    missing.code = 'NATIVE_MODULE_MISSING';
    throw missing;
  }

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // v13+ of this library wraps the result as { type: 'success', data: User }
  // or { type: 'cancelled', data: null } — it is NOT `{ idToken }` directly.
  // Destructuring idToken off the top-level response (an earlier version of
  // this function did) silently gives undefined, which Firebase then fails
  // on with an opaque native-bridge error rather than a clear one.
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success') {
    const cancelled = new Error('Google sign-in was cancelled.');
    cancelled.code = 'SIGN_IN_CANCELLED';
    throw cancelled;
  }

  const { idToken } = response.data;
  if (!idToken) {
    throw new Error('Google did not return an ID token — check that GOOGLE_WEB_CLIENT_ID in config.js is correct.');
  }

  const credential = auth.GoogleAuthProvider.credential(idToken);
  const userCredential = await auth().signInWithCredential(credential);
  return userCredential.user.getIdToken();
};
