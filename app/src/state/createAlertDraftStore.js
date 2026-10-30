import { create } from 'zustand';

const initial = {
  alertType: null, // product | brand
  editingAlertId: null,
  productName: '',
  brandName: '',
  productUrl: '',
  imageUrl: '',
  currentPrice: null,
  originalPrice: null,
  sku: '',
  variant: '',
  analyzePartial: false,
  analyzeFailed: false,
  alreadyOnSale: false,
  discountPct: null,
  // notify_now | watch_for_drop — only used when alreadyOnSale
  alreadyOnSaleChoice: 'notify_now',
  conditionType: 'any_sale',
  customPct: 25,
  targetPrice: null,
  notifyPush: true,
  notifyEmail: false,
  notifyInApp: true,
};

const useCreateAlertDraftStore = create((set) => ({
  ...initial,
  reset: () => set({ ...initial }),
  setField: (key, value) => set({ [key]: value }),
  setProductFields: (fields) => set({ ...fields }),
  loadFromAlert: (alert) =>
    set({
      ...initial,
      editingAlertId: alert.id,
      alertType: alert.alert_type,
      productName: alert.product_name || '',
      brandName: alert.brand_name || '',
      productUrl: alert.product_url || '',
      imageUrl: alert.image_url || '',
      currentPrice: alert.current_price ?? null,
      originalPrice: alert.original_price ?? null,
      sku: alert.sku || '',
      variant: alert.variant || '',
      conditionType: alert.condition_type || 'any_sale',
      customPct: alert.custom_pct ?? 25,
      targetPrice: alert.target_price ?? null,
      notifyPush: !!alert.notify_push,
      notifyEmail: !!alert.notify_email,
      notifyInApp: !!alert.notify_in_app,
      alreadyOnSale: false,
      discountPct: null,
      alreadyOnSaleChoice: alert.watch_below_price != null ? 'watch_for_drop' : 'notify_now',
    }),
}));

export default useCreateAlertDraftStore;
