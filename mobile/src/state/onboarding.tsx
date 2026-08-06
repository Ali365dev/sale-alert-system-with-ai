import { createContext, useContext, useMemo, useState } from 'react';

interface OnboardingContextValue {
  topics: string[];
  toggleTopic: (topic: string) => void;
  brandIds: string[];
  toggleBrand: (id: string) => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: React.ReactNode }) {
  const [topics, setTopics] = useState<string[]>([]);
  const [brandIds, setBrandIds] = useState<string[]>([]);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const value = useMemo(
    () => ({
      topics,
      toggleTopic: (t: string) => toggle(topics, setTopics, t),
      brandIds,
      toggleBrand: (id: string) => toggle(brandIds, setBrandIds, id),
    }),
    [topics, brandIds]
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used within OnboardingProvider');
  return ctx;
}
