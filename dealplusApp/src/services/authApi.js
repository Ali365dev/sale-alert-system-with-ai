import { appAxios } from './apiInterceptors';
import { getDeviceId } from '../utils/deviceId';

/** Returns { ok: true, token, user, brands, categories } on success, or
 * { ok: false, error } on failure — callers show `error` directly, it's
 * already a user-facing message from the backend (or a generic fallback). */
const authRequest = async (path, body) => {
  try {
    const response = await appAxios.post(path, { ...body, device_id: getDeviceId() });
    return { ok: true, ...response.data };
  } catch (error) {
    const message = error?.response?.data?.error || 'Something went wrong. Please try again.';
    return { ok: false, error: message };
  }
};

export const signup = ({ email, password, name }) => authRequest('/auth/signup', { email, password, name });

export const login = ({ email, password }) => authRequest('/auth/login', { email, password });

/** idToken is a *Firebase* ID token (see googleAuth.js::signInWithGoogle),
 * not a raw Google one — the backend verifies it via Firebase Admin. */
export const loginWithGoogle = (idToken) => authRequest('/auth/google', { id_token: idToken });
