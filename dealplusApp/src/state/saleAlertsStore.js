import { create } from 'zustand';
import {
  createSaleAlert,
  deleteSaleAlert,
  fetchSaleAlerts,
  updateSaleAlert,
} from '../services/saleAlertsApi';

const emptySummary = { active: 0, products: 0, brands: 0, triggered: 0 };

const useSaleAlertsStore = create((set, get) => ({
  alerts: [],
  summary: emptySummary,
  loading: false,
  error: null,

  loadAlerts: async () => {
    set({ loading: true, error: null });
    try {
      const data = await fetchSaleAlerts();
      set({
        alerts: data.alerts ?? [],
        summary: data.summary ?? emptySummary,
        loading: false,
      });
    } catch (error) {
      set({ loading: false, error: error?.message ?? 'Failed to load alerts' });
    }
  },

  addAlert: async (payload) => {
    const alert = await createSaleAlert(payload);
    const alerts = [alert, ...get().alerts.filter((a) => a.id !== alert.id)];
    set({
      alerts,
      summary: {
        active: alerts.filter((a) => a.status === 'active').length,
        products: alerts.filter((a) => a.alert_type === 'product').length,
        brands: alerts.filter((a) => a.alert_type === 'brand').length,
        triggered: alerts.filter((a) => a.status === 'triggered').length,
      },
    });
    return alert;
  },

  patchAlert: async (id, patch) => {
    const alert = await updateSaleAlert(id, patch);
    const alerts = get().alerts.map((a) => (a.id === id ? alert : a));
    set({
      alerts,
      summary: {
        active: alerts.filter((a) => a.status === 'active').length,
        products: alerts.filter((a) => a.alert_type === 'product').length,
        brands: alerts.filter((a) => a.alert_type === 'brand').length,
        triggered: alerts.filter((a) => a.status === 'triggered').length,
      },
    });
    return alert;
  },

  removeAlert: async (id) => {
    await deleteSaleAlert(id);
    const alerts = get().alerts.filter((a) => a.id !== id);
    set({
      alerts,
      summary: {
        active: alerts.filter((a) => a.status === 'active').length,
        products: alerts.filter((a) => a.alert_type === 'product').length,
        brands: alerts.filter((a) => a.alert_type === 'brand').length,
        triggered: alerts.filter((a) => a.status === 'triggered').length,
      },
    });
  },
}));

export default useSaleAlertsStore;
