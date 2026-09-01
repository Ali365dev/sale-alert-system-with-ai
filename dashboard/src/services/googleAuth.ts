import { signInWithPopup } from "firebase/auth";

import { firebaseAuth, googleAuthProvider, isGoogleSignInConfigured } from "../config/firebase";

/** Runs Firebase's Google popup flow and returns the resulting *Firebase* ID
 * token — the backend verifies this (services/firebase_auth.py), never a raw
 * Google credential, same contract as dealplusApp/src/services/googleAuth.js.
 * signInWithPopup signs the user directly into Firebase (unlike the mobile
 * flow, there's no separate "exchange a Google token for a Firebase one"
 * step), so result.user.getIdToken() is already the token to send. Throws on
 * cancellation (popup closed) or failure; callers should catch and show an
 * error rather than treat every rejection as fatal. */
export const signInWithGoogle = async (): Promise<string> => {
  if (!isGoogleSignInConfigured) {
    throw new Error("Google sign-in isn't configured for this build yet.");
  }
  const result = await signInWithPopup(firebaseAuth, googleAuthProvider);
  return result.user.getIdToken();
};
