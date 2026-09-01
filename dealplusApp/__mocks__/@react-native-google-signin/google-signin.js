// Manual Jest mock for @react-native-google-signin/google-signin — native
// module, no Google Play Services / account picker exists under Jest.
//
// signIn()'s shape here matches v13+'s real wrapped response
// ({ type: 'success', data: User } | { type: 'cancelled', data: null }) —
// not the older flat `{ idToken }` shape — since src/services/googleAuth.js
// getting this wrong (destructuring idToken off the top level) was a real
// bug that shipped once already.
module.exports = {
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn().mockResolvedValue({
      type: 'success',
      data: { idToken: 'mock-google-id-token', user: {}, scopes: [], serverAuthCode: null },
    }),
    signOut: jest.fn().mockResolvedValue(undefined),
    isSignedIn: jest.fn().mockResolvedValue(false),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
};
