import { GoogleSignin } from '@react-native-google-signin/google-signin';
import auth from '@react-native-firebase/auth';
import { configureGoogleSignIn, signInWithGoogle } from '../googleAuth';

const authInstance = auth();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('configureGoogleSignIn', () => {
  test('configures GoogleSignin with the configured web client ID', () => {
    configureGoogleSignIn();
    // config.js's GOOGLE_WEB_CLIENT_ID is set for this project — if it were
    // ever blank again, configure() must not be called at all (see the
    // early-return in googleAuth.js), so asserting the call happened here
    // is itself a guard against that regressing unnoticed.
    expect(GoogleSignin.configure).toHaveBeenCalledWith({ webClientId: expect.any(String) });
  });
});

describe('signInWithGoogle', () => {
  test('on success, parses idToken out of the v13+ wrapped { type, data } response', async () => {
    GoogleSignin.signIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'real-google-id-token', user: {}, scopes: [], serverAuthCode: null },
    });

    await signInWithGoogle();

    expect(auth.GoogleAuthProvider.credential).toHaveBeenCalledWith('real-google-id-token');
    expect(authInstance.signInWithCredential).toHaveBeenCalled();
  });

  test('returns the Firebase ID token (not the Google one) for the backend to verify', async () => {
    GoogleSignin.signIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'google-id-token', user: {}, scopes: [], serverAuthCode: null },
    });

    const result = await signInWithGoogle();
    expect(result).toBe('mock-firebase-id-token');
  });

  test('a cancelled picker ({ type: "cancelled" }) throws a recognizable SIGN_IN_CANCELLED error, not a crash', async () => {
    GoogleSignin.signIn.mockResolvedValue({ type: 'cancelled', data: null });

    await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'SIGN_IN_CANCELLED' });
    expect(auth.GoogleAuthProvider.credential).not.toHaveBeenCalled();
  });

  test('a success response with no idToken fails clearly instead of silently calling Firebase with undefined', async () => {
    GoogleSignin.signIn.mockResolvedValue({
      type: 'success',
      data: { idToken: null, user: {}, scopes: [], serverAuthCode: null },
    });

    await expect(signInWithGoogle()).rejects.toThrow(/did not return an ID token/);
    expect(auth.GoogleAuthProvider.credential).not.toHaveBeenCalled();
  });

  test('checks Play Services availability before attempting sign-in', async () => {
    GoogleSignin.signIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'token', user: {}, scopes: [], serverAuthCode: null },
    });

    await signInWithGoogle();
    expect(GoogleSignin.hasPlayServices).toHaveBeenCalled();
  });
});
