import { appAxios } from './apiInterceptors';
import { getDeviceId } from '../utils/deviceId';

export const fetchSaleAlerts = async () => {
  const { data } = await appAxios.get('/sale-alerts', { params: { device_id: getDeviceId() } });
  return data;
};

export const createSaleAlert = async (payload) => {
  const { data } = await appAxios.post('/sale-alerts', { ...payload, device_id: getDeviceId() });
  return data;
};

export const updateSaleAlert = async (id, patch) => {
  const { data } = await appAxios.patch(`/sale-alerts/${id}`, { ...patch, device_id: getDeviceId() });
  return data;
};

export const deleteSaleAlert = async (id) => {
  const { data } = await appAxios.delete(`/sale-alerts/${id}`, { params: { device_id: getDeviceId() } });
  return data;
};

const analyzeErrorMessage = (error) => {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail || error?.response?.data?.error;
  if (status === 404) {
    return 'Product lookup is not available on the server yet. Update the backend, then try again.';
  }
  if (status === 502 || status === 503 || status === 504) {
    return 'The server is waking up or busy. Wait a moment and try again.';
  }
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (error?.message === 'Network Error') {
    return "Couldn't reach the server. Check your connection and try again.";
  }
  return error?.message || "We couldn't automatically identify this product.";
};

export const analyzeProductUrl = async (url) => {
  try {
    const { data } = await appAxios.post('/sale-alerts/analyze-product', { url }, { timeout: 60000 });
    return data;
  } catch (error) {
    const wrapped = new Error(analyzeErrorMessage(error));
    wrapped.cause = error;
    wrapped.response = error?.response;
    throw wrapped;
  }
};

export const checkSaleAlert = async (id) => {
  const { data } = await appAxios.post(
    `/sale-alerts/${id}/check`,
    { device_id: getDeviceId() },
    { timeout: 45000 },
  );
  return data;
};

export const conditionLabel = (alert) => {
  switch (alert?.condition_type) {
    case 'any_sale':
      return 'Any sale';
    case 'pct_10':
      return '10% or more off';
    case 'pct_20':
      return '20% or more off';
    case 'pct_30':
      return '30% or more off';
    case 'custom_pct':
      return `${alert.custom_pct ?? '?'}% or more off`;
    case 'target_price':
      return `Price below $${alert.target_price ?? '?'}`;
    case 'new_promotion':
      return 'New promotion';
    case 'new_code':
      return 'New discount code';
    default:
      return 'Any sale';
  }
};

export const notifyLabel = (alert) => {
  const parts = [];
  if (alert?.notify_push) parts.push('Push');
  if (alert?.notify_email) parts.push('Email');
  if (alert?.notify_in_app) parts.push('In-app');
  return parts.length ? parts.join(' + ') : 'None';
};
