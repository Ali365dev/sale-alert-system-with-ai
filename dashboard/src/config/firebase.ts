import { getApps, initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth } from "firebase/auth";

// Same Firebase project as dealplusApp ("sale-alert-sys"). apiKey/projectId/
// storageBucket/messagingSenderId are project-wide and safe to hardcode (they
// aren't secrets — Firebase's security model relies on server-side rules /
// token verification, not on hiding these). VITE_FIREBASE_APP_ID is the one
// value that's specific to a *Web app* registration and doesn't exist yet
// for this project — see dashboard/.env for where to get it. Until it's set,
// Google sign-in is disabled client-side (same pattern as GOOGLE_WEB_CLIENT_ID
// in dealplusApp/src/services/config.js).
const firebaseConfig = {
  apiKey: "AIzaSyDw4EHIwkJg8m6Ug8Laxc0s6fqWw0LIjUE",
  authDomain: "sale-alert-sys.firebaseapp.com",
  projectId: "sale-alert-sys",
  storageBucket: "sale-alert-sys.firebasestorage.app",
  messagingSenderId: "254426897331",
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? "",
};

export const isGoogleSignInConfigured = Boolean(firebaseConfig.appId);

const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);
export const googleAuthProvider = new GoogleAuthProvider();
