/**
 * @format
 *
 * App startup calls loadDeals() (real /brands + /offers requests) and the
 * push-notification setup (device token registration) directly in a
 * useEffect with no environment awareness — previously this test only got
 * as far as a native-module crash (Clarity, then Firebase messaging, then
 * a safe-area-context incompatibility; see jest.config.js and __mocks__/)
 * before ever reaching that network call. Now that those are fixed, this
 * mocks the actual network boundary (appAxios) so the app's real startup
 * path — loadDeals(), its brand/offer derivation, and device token
 * registration — runs against controlled data instead of hitting
 * localhost:8000 or failing with ECONNREFUSED.
 */
jest.mock('../src/services/apiInterceptors', () => ({
  appAxios: {
    get: jest.fn((url) => {
      if (url === '/brands') return Promise.resolve({ data: { brands: [] } });
      if (url === '/offers') return Promise.resolve({ data: { offers: [] } });
      if (url === '/preferences') return Promise.resolve({ data: { brands: [], categories: [] } });
      return Promise.resolve({ data: {} });
    }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  // SplashScreen holds real setTimeouts (up to MIN_VISIBLE_MS + a 6s ceiling)
  // that fire a navigation dispatch once it decides to hand off — with real
  // timers those fire after this test (and Jest's environment teardown),
  // producing "update not wrapped in act" noise and a stray post-teardown
  // import error. Fake timers let that whole chain resolve deterministically
  // inside the test instead of leaking past it.
  jest.useFakeTimers();
  try {
    await ReactTestRenderer.act(async () => {
      ReactTestRenderer.create(<App />);
    });
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(8000);
    });
  } finally {
    jest.useRealTimers();
  }
});
