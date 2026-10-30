import useOnboardingGateStore from '../onboardingGateStore';
import { Storage } from '../storage';

beforeEach(() => {
  useOnboardingGateStore.setState({ hasOnboarded: false }, false);
  Storage.delete('dealpulse:hasOnboarded');
});

test('a fresh install (nothing in storage) starts with hasOnboarded false', () => {
  expect(useOnboardingGateStore.getState().hasOnboarded).toBe(false);
});

test('completeOnboarding flips the in-memory flag to true', () => {
  useOnboardingGateStore.getState().completeOnboarding();
  expect(useOnboardingGateStore.getState().hasOnboarded).toBe(true);
});

test('completeOnboarding persists the flag to storage so a restart reads it back correctly', () => {
  useOnboardingGateStore.getState().completeOnboarding();
  expect(Storage.getString('dealpulse:hasOnboarded')).toBe('true');
});
