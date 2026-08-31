/**
 * Performance regression test for the list-entrance stagger delay.
 *
 * Without a cap, item #500 in a long list would wait 500 * step-ms before
 * fading in — a multi-minute delay that reads as "broken," not "staggered."
 * MAX_STAGGER_INDEX exists specifically to bound that; this test fails if
 * the cap is ever removed or bypassed. Tested as a plain function (rather
 * than by rendering AnimatedListItem/SelectableCard through Reanimated)
 * since this project's Jest setup has no native-worklets mock — see
 * __tests__/App.test.tsx, which already fails on an unrelated native
 * module for the same underlying reason.
 */
import { MAX_STAGGER_INDEX, STAGGER_STEP_MS, staggerDelay } from '../stagger';

test('staggers items within the cap proportionally to their position', () => {
  expect(staggerDelay(0)).toBe(0);
  expect(staggerDelay(3)).toBe(3 * STAGGER_STEP_MS);
});

test('caps the delay for items far down a long list instead of growing unbounded', () => {
  expect(staggerDelay(MAX_STAGGER_INDEX)).toBe(MAX_STAGGER_INDEX * STAGGER_STEP_MS);
  expect(staggerDelay(500)).toBe(MAX_STAGGER_INDEX * STAGGER_STEP_MS);
});
