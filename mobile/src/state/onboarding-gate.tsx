import Storage from 'expo-sqlite/kv-store';
import { createContext, useContext, useMemo, useState } from 'react';

const HAS_ONBOARDED_KEY = 'dealpulse:hasOnboarded';

interface OnboardingGateValue {
  hasOnboarded: boolean;
  completeOnboarding: () => void;
}

const OnboardingGateContext = createContext<OnboardingGateValue | null>(null);

export function OnboardingGateProvider({ children }: { children: React.ReactNode }) {
  const [hasOnboarded, setHasOnboarded] = useState(
    () => Storage.getItemSync(HAS_ONBOARDED_KEY) === 'true'
  );

  const value = useMemo(
    () => ({
      hasOnboarded,
      completeOnboarding: () => {
        Storage.setItemSync(HAS_ONBOARDED_KEY, 'true');
        setHasOnboarded(true);
      },
    }),
    [hasOnboarded]
  );

  return <OnboardingGateContext.Provider value={value}>{children}</OnboardingGateContext.Provider>;
}

export function useOnboardingGate() {
  const ctx = useContext(OnboardingGateContext);
  if (!ctx) throw new Error('useOnboardingGate must be used within OnboardingGateProvider');
  return ctx;
}
