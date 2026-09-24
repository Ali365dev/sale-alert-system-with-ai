import auth from '@react-native-firebase/auth';
import { Platform } from 'react-native';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from './config';
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
  const config = { webClientId: GOOGLE_WEB_CLIENT_ID, offlineAccess: false };
  // iOS client ID from GoogleService-Info.plist — helps the native SDK pick
  // the correct OAuth client when multiple are registered on the Firebase project.
  if (Platform.OS === 'ios' && GOOGLE_IOS_CLIENT_ID) {
    config.iosClientId = GOOGLE_IOS_CLIENT_ID;
  }
  GoogleSignin.configure(config);
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

  if (!GOOGLE_WEB_CLIENT_ID) {
    const unconfigured = new Error('Google Sign-In is not configured (missing web client ID).');
    unconfigured.code = 'NOT_CONFIGURED';
    throw unconfigured;
  }

  // Play Services check is Android-only — calling it on iOS can fail the flow.
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  // v13+ of this library wraps the result as { type: 'success', data: User }
  // or { type: 'cancelled', data: null } — it is NOT `{ idToken }` directly.
  const response = await GoogleSignin.signIn();
  if (response.type !== 'success') {
    const cancelled = new Error('Google sign-in was cancelled.');
    cancelled.code = 'SIGN_IN_CANCELLED';
    throw cancelled;
  }

  const { idToken } = response.data ?? {};
  if (!idToken) {
    throw new Error(
      'Google did not return an ID token — check that GOOGLE_WEB_CLIENT_ID in config.js matches the Web client in Firebase, and that the iOS URL scheme (REVERSED_CLIENT_ID) is set in Info.plist.',
    );
  }

  const credential = auth.GoogleAuthProvider.credential(idToken);
  const userCredential = await auth().signInWithCredential(credential);
  return userCredential.user.getIdToken();
};
