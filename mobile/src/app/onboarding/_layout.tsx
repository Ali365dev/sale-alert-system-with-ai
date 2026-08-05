import { Stack } from 'expo-router';

import { OnboardingProvider } from '@/state/onboarding';

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </OnboardingProvider>
  );
}
