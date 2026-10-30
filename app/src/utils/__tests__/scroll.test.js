import { isCloseToBottom } from '../scroll';

const event = (visibleHeight, scrollY, totalContentHeight) => ({
  layoutMeasurement: { height: visibleHeight },
  contentOffset: { y: scrollY },
  contentSize: { height: totalContentHeight },
});

test('false when far from the bottom', () => {
  expect(isCloseToBottom(event(800, 0, 5000))).toBe(false);
});

test('true once within the default 150px threshold of the bottom', () => {
  // visible bottom edge = 800 + 4860 = 5660, content height 5700 -> 40px left
  expect(isCloseToBottom(event(800, 4860, 5700))).toBe(true);
});

test('true exactly at the bottom (visible bottom edge equals content height)', () => {
  expect(isCloseToBottom(event(800, 200, 1000))).toBe(true);
});

test('a custom threshold is honored', () => {
  const e = event(800, 100, 2000); // visible bottom edge = 900, 1100px from the true bottom
  expect(isCloseToBottom(e, 150)).toBe(false);
  expect(isCloseToBottom(e, 1200)).toBe(true);
});

test('content shorter than the viewport is always "close to bottom"', () => {
  expect(isCloseToBottom(event(800, 0, 400))).toBe(true);
});
