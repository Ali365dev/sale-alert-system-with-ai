import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { BASE_URL } from './config';
import { showErrorToast } from '../utils/CustomToast';
import useAuthStore from '../state/authStore';

// Render free-tier servers cold-start in 20-30s; iOS HTTP/3→HTTP/2 fallback
// adds extra latency on first connection. Cloudflare (fronting Render) sends
// `alt-svc: h3=...` on every response, so iOS's NSURLSession can still pick
// HTTP/3 for a request even with assumesHTTP3Capable=NO (see
// ios/dealplusApp/DisableHTTP3.m) — on some networks that QUIC connection
// stalls outright rather than erroring, silently eating the whole timeout.
// A shorter per-attempt timeout + more retries recovers faster than one long
// wait, since a retried request is more likely to land on a fresh (non-
// stalled) connection path than the original hanging one.
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 2;

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
    return Promise.reject(new Error('No internet connection'));
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
    // A transient "Network Error" or timeout gets up to MAX_RETRIES retries,
    // through appAxios itself (not the raw axios instance) so each retry
    // still gets the timeout above and a fresh connectivity check.
    const retryCount = error.config?.__retryCount ?? 0;
    const isRetriable = (error.message === 'Network Error' || error.code === 'ECONNABORTED') && error.config && retryCount < MAX_RETRIES;
    if (isRetriable) {
      return appAxios({ ...error.config, __retryCount: retryCount + 1 });
    }
    return Promise.reject(error);
  },
);
