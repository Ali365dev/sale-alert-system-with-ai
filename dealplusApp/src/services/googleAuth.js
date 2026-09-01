import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import { GOOGLE_WEB_CLIENT_ID } from './config';

/** Call once at app startup (see App.js) — no-op until a real
 * GOOGLE_WEB_CLIENT_ID replaces the placeholder in src/services/config.js
 * (see that file for where to get one, once Google sign-in is enabled in
 * the Firebase console). */
export const configureGoogleSignIn = () => {
  if (!GOOGLE_WEB_CLIENT_ID) return;
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
