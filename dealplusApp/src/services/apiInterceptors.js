import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { BASE_URL } from './config';
import { showErrorToast } from '../utils/CustomToast';
import useAuthStore from '../state/authStore';

const REQUEST_TIMEOUT_MS = 15000;

export const appAxios = axios.create({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
});

appAxios.interceptors.request.use(async (config) => {
  const state = await NetInfo.fetch();
  // Only hard-block when Wi‑Fi/cellular is clearly off. Do not require
  // `isInternetReachable` — that is often false on LAN-only / captive Wi‑Fi
  // even though the Mac API at 192.168.x.x is reachable.
  if (state.isConnected === false) {
    showErrorToast('No internet connection');
    return Promise.reject({ msg: 'No internet connection' });
  }

  const token = useAuthStore.getState().token;
  config.headers = {
    'Content-Type': 'application/json; charset=utf-8',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...config.headers,
  };

  return config;
});

appAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    // A transient "Network Error" gets exactly one retry, through appAxios
    // itself (not the raw axios instance) so it still gets the timeout
    // above and a fresh connectivity check — and the __isRetry flag means
    // this can never retry more than once even if it fails again.
    if (error.message === 'Network Error' && error.config && !error.config.__isRetry) {
      return appAxios({ ...error.config, __isRetry: true });
    }
    return Promise.reject(error);
  },
);
