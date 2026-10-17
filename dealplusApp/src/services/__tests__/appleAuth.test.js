jest.mock('@invertase/react-native-apple-authentication');

import auth from '@react-native-firebase/auth';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { formatAppleFullName, signInWithApple } from '../appleAuth';

describe('formatAppleFullName', () => {
  test('joins given + family name', () => {
    expect(formatAppleFullName({ givenName: 'Ada', familyName: 'Lovelace' })).toBe('Ada Lovelace');
  });

  test('returns undefined when Apple sends no name', () => {
    expect(formatAppleFullName(null)).toBeUndefined();
    expect(formatAppleFullName({})).toBeUndefined();
  });
});

describe('signInWithApple', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appleAuth.performRequest.mockResolvedValue({
      identityToken: 'apple-id-token',
      nonce: 'nonce-1',
      fullName: { givenName: 'Ada', familyName: 'Lovelace' },
    });
  });

  test('exchanges Apple identity token for a Firebase ID token', async () => {
    const result = await signInWithApple();

    expect(appleAuth.performRequest).toHaveBeenCalledWith({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
    });
    expect(auth.AppleAuthProvider.credential).toHaveBeenCalledWith('apple-id-token', 'nonce-1');
    expect(result).toEqual({ idToken: 'mock-firebase-id-token', name: 'Ada Lovelace' });
  });

  test('maps Apple cancel to SIGN_IN_CANCELLED', async () => {
    appleAuth.performRequest.mockRejectedValue({ code: appleAuth.Error.CANCELED });

    await expect(signInWithApple()).rejects.toMatchObject({ code: 'SIGN_IN_CANCELLED' });
    expect(auth.AppleAuthProvider.credential).not.toHaveBeenCalled();
  });

  test('fails clearly when Apple returns no identity token', async () => {
    appleAuth.performRequest.mockResolvedValue({ identityToken: null, nonce: 'n' });

    await expect(signInWithApple()).rejects.toThrow(/identity token/);
  });
});
