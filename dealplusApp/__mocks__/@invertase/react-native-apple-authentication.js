// Manual Jest mock — native Apple Auth is unavailable under Jest.
const appleAuth = {
  isSupported: true,
  Operation: { IMPLICIT: 0, LOGIN: 1, REFRESH: 2, LOGOUT: 3 },
  Scope: { EMAIL: 0, FULL_NAME: 1 },
  Error: { UNKNOWN: '1000', CANCELED: '1001', INVALID_RESPONSE: '1002', NOT_HANDLED: '1003', FAILED: '1004' },
  performRequest: jest.fn().mockResolvedValue({
    identityToken: 'mock-apple-identity-token',
    nonce: 'mock-nonce',
    fullName: { givenName: 'Ada', familyName: 'Lovelace' },
    email: 'ada@privaterelay.appleid.com',
  }),
};

module.exports = { appleAuth, default: appleAuth };
