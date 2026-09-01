// Manual Jest mock for @react-native-firebase/auth — the real package
// constructs a native module at import time, which throws under Jest (same
// class of issue as @react-native-firebase/messaging's own mock).
const mockUser = { getIdToken: jest.fn().mockResolvedValue('mock-firebase-id-token') };

const authInstance = {
  signInWithCredential: jest.fn().mockResolvedValue({ user: mockUser }),
  signOut: jest.fn().mockResolvedValue(undefined),
  currentUser: null,
};

const auth = () => authInstance;
auth.GoogleAuthProvider = {
  credential: jest.fn((idToken) => ({ idToken, providerId: 'google.com' })),
};

module.exports = auth;
module.exports.default = auth;
