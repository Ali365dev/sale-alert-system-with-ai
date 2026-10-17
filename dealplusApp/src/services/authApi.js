import { appAxios } from './apiInterceptors';
import { getDeviceId } from '../utils/deviceId';

const authErrorMessage = (error) => {
  const data = error?.response?.data;
  if (typeof data?.error === 'string' && data.error.trim()) return data.error;
  if (typeof data?.detail === 'string' && data.detail.trim()) return data.detail;
  if (data?.detail && typeof data.detail === 'object' && typeof data.detail.msg === 'string') {
    return data.detail.msg;
  }
  // No HTTP response → phone/simulator couldn't reach BASE_URL (wrong LAN IP,
  // API bound to 127.0.0.1 only, or server down).
  if (!error?.response) {
    return "Can't reach the server. Check that the API is running and try again.";
  }
  return 'Something went wrong. Please try again.';
};

/** Returns { ok: true, token, user, brands, categories } on success, or
 * { ok: false, error } on failure — callers show `error` directly, it's
 * already a user-facing message from the backend (or a generic fallback). */
const authRequest = async (path, body) => {
  try {
    const response = await appAxios.post(path, { ...body, device_id: getDeviceId() });
    return { ok: true, ...response.data };
  } catch (error) {
    return { ok: false, error: authErrorMessage(error) };
  }
};

export const signup = ({ email, password, name }) => authRequest('/auth/signup', { email, password, name });

export const login = ({ email, password }) => authRequest('/auth/login', { email, password });

/** Request a password-reset OTP email. Backend always returns a generic
 * success message (no email enumeration). When PASSWORD_RESET_DEV_ECHO is
 * on server-side, the response may include `dev_code` for local testing. */
export const forgotPassword = ({ email }) => authRequest('/auth/forgot-password', { email });

/** Verify the emailed OTP and set a new password. */
export const resetPassword = ({ email, code, password }) =>
  authRequest('/auth/reset-password', { email, code, password });

/** idToken is a *Firebase* ID token (see googleAuth.js::signInWithGoogle),
 * not a raw Google one — the backend verifies it via Firebase Admin. */
export const loginWithGoogle = (idToken) => authRequest('/auth/google', { id_token: idToken });

/** Firebase ID token from appleAuth.js::signInWithApple. Optional `name` is
 * Apple's one-time fullName (only on first authorize). */
export const loginWithApple = (idToken, { name } = {}) =>
  authRequest('/auth/apple', { id_token: idToken, name: name || undefined });

/** Permanently deletes the signed-in account and its saved preferences
 * (Google Play's Account Deletion policy requirement for any app that
 * supports account creation — see app/api/routers/auth.py::delete_me).
 * Returns { ok: true } or { ok: false, error }; the caller is responsible
 * for clearing local auth state (useAuthStore.clearAuth()) on success. */
export const deleteAccount = async () => {
  try {
    await appAxios.delete('/auth/me');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: authErrorMessage(error) || "Couldn't delete your account. Please try again." };
  }
};
