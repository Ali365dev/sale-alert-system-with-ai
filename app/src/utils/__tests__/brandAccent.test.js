import { accentFromName, contrastOn, luminance, pickAccentFromResult, softTint } from '../brandAccent';

test('pickAccentFromResult prefers vivid android swatches over near-white', () => {
  expect(
    pickAccentFromResult({
      platform: 'android',
      vibrant: '#F5CB1B',
      dominant: '#FFFFFF',
      darkVibrant: '#D97706',
      lightVibrant: '#FEF9C3',
      average: '#F5F5F5',
      muted: '#A8A29E',
    }),
  ).toBe('#F5CB1B');
});

test('pickAccentFromResult uses iOS background when usable', () => {
  expect(
    pickAccentFromResult({
      platform: 'ios',
      background: '#F5CB1B',
      primary: '#111111',
      secondary: '#FFFFFF',
      detail: '#CCCCCC',
    }),
  ).toBe('#F5CB1B');
});

test('contrastOn picks dark text on light yellow', () => {
  expect(contrastOn('#F5CB1B')).toBe('#10233F');
  expect(contrastOn('#F20D38')).toBe('#FFFFFF');
  expect(luminance('#F5CB1B')).toBeGreaterThan(0.55);
});

test('accentFromName is stable for the same brand', () => {
  expect(accentFromName('Cheezious')).toBe(accentFromName('Cheezious'));
  expect(accentFromName('')).toBe('#F20D38');
});

test('softTint washes accent toward white', () => {
  expect(softTint('#F20D38', 1)).toBe('#FFFFFF');
  expect(softTint('#000000', 0)).toBe('#000000');
  expect(softTint('#3478F6', 0.5)).toMatch(/^#[0-9A-F]{6}$/);
});
