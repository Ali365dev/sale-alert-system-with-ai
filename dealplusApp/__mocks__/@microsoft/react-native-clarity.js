// Manual Jest mock for @microsoft/react-native-clarity — the real module
// constructs a NativeEventEmitter at import time, which throws under Jest's
// mocked native environment (this was already crashing __tests__/App.test.tsx
// before any of this test suite existed). No-op stubs are all any caller needs.
module.exports = {
  initialize: jest.fn(),
  setCustomUserId: jest.fn(),
  setCustomTag: jest.fn(),
  setCurrentScreenName: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
};
