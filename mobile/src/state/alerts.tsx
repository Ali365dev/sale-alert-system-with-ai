import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { AlertChannels, AlertCondition, TrackedAlert } from '@/types/dealpulse';

// ---------------------------------------------------------------------------
// AlertsProvider — the persisted (session-lifetime) list of tracked alerts.
// No backend exists yet for alerts (see database/models.py) — this mirrors
// state/favorites.tsx's plain in-memory Context pattern until one does.
// ---------------------------------------------------------------------------

interface AlertsContextValue {
  alerts: TrackedAlert[];
  addAlert: (input: Omit<TrackedAlert, 'id' | 'createdAt' | 'status'>) => TrackedAlert;
  removeAlert: (id: string) => void;
  toggleTriggered: (id: string) => void;
}

const AlertsContext = createContext<AlertsContextValue | null>(null);

export function AlertsProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<TrackedAlert[]>([]);

  const addAlert = useCallback((input: Omit<TrackedAlert, 'id' | 'createdAt' | 'status'>) => {
    const alert: TrackedAlert = {
      ...input,
      id: `alert-${Date.now()}-${Math.round(Math.random() * 1000)}`,
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    setAlerts((prev) => [alert, ...prev]);
    return alert;
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // No trigger engine exists yet (see the backend gap discussed earlier) — this lets
  // an alert be marked triggered manually so the "Recently Triggered" banner and
  // TRIGGERED badge can actually be seen/tested in the meantime.
  const toggleTriggered = useCallback((id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: a.status === 'triggered' ? 'active' : 'triggered' } : a))
    );
  }, []);

  const value = useMemo(
    () => ({ alerts, addAlert, removeAlert, toggleTriggered }),
    [alerts, addAlert, removeAlert, toggleTriggered]
  );

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlerts must be used within AlertsProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// CreateAlertProvider — the in-progress draft for the 5-step create-alert
// wizard. Scoped to app/create-alert/_layout.tsx only, so it resets every
// time the wizard is entered.
// ---------------------------------------------------------------------------

export interface AlertDraft {
  type: 'product' | 'brand' | null;
  brandId: string | null;
  brandName: string;
  productName: string | null;
  productUrl: string | null;
  image: string | null;
  currentPrice: number | null;
  originalPrice: number | null;
  condition: AlertCondition;
  conditionValue: number | null;
  channels: AlertChannels;
  autoAnalyzeFailed: boolean;
}

const EMPTY_DRAFT: AlertDraft = {
  type: null,
  brandId: null,
  brandName: '',
  productName: null,
  productUrl: null,
  image: null,
  currentPrice: null,
  originalPrice: null,
  condition: 'any_sale',
  conditionValue: null,
  channels: { push: true, email: true, inApp: false },
  autoAnalyzeFailed: false,
};

interface CreateAlertContextValue {
  draft: AlertDraft;
  updateDraft: (patch: Partial<AlertDraft>) => void;
  resetDraft: () => void;
}

const CreateAlertContext = createContext<CreateAlertContextValue | null>(null);

export function CreateAlertProvider({ children }: { children: React.ReactNode }) {
  const [draft, setDraft] = useState<AlertDraft>(EMPTY_DRAFT);

  const updateDraft = useCallback((patch: Partial<AlertDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetDraft = useCallback(() => setDraft(EMPTY_DRAFT), []);

  const value = useMemo(() => ({ draft, updateDraft, resetDraft }), [draft, updateDraft, resetDraft]);

  return <CreateAlertContext.Provider value={value}>{children}</CreateAlertContext.Provider>;
}

export function useCreateAlert() {
  const ctx = useContext(CreateAlertContext);
  if (!ctx) throw new Error('useCreateAlert must be used within CreateAlertProvider');
  return ctx;
}

const CONDITION_LABELS: Record<AlertCondition, string> = {
  any_sale: 'Any sale',
  '10_off': '10% or more off',
  '20_off': '20% or more off',
  '30_off': '30% or more off',
  custom: 'Custom discount',
  price_below: 'Price drops below',
};

export function conditionLabel(condition: AlertCondition, value: number | null): string {
  if (condition === 'custom' && value != null) return `${value}% or more off`;
  if (condition === 'price_below' && value != null) return `Price drops below $${value}`;
  return CONDITION_LABELS[condition];
}

const SHORT_CONDITION_LABELS: Record<AlertCondition, string> = {
  any_sale: 'Any Sale',
  '10_off': '10% OFF',
  '20_off': '20% OFF',
  '30_off': '30% OFF',
  custom: 'OFF',
  price_below: 'Price Drop',
};

/** Compact pill text — "20% OFF" / "Any Sale" — for the dashboard's alert cards. */
export function shortConditionLabel(condition: AlertCondition, value: number | null): string {
  if (condition === 'custom' && value != null) return `${value}% OFF`;
  if (condition === 'price_below' && value != null) return `Below $${value}`;
  return SHORT_CONDITION_LABELS[condition];
}

/** Whether the condition represents an actual discount (vs. "any sale"), for pill coloring. */
export function isDiscountCondition(condition: AlertCondition): boolean {
  return condition !== 'any_sale';
}
