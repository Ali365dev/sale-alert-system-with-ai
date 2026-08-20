import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { BASE_URL } from './config';
import { showErrorToast } from '../utils/CustomToast';

export const appAxios = axios.create({
  baseURL: BASE_URL,
});

appAxios.interceptors.request.use(async (config) => {
  const state = await NetInfo.fetch();
  if (!state.isConnected && !state.isInternetReachable) {
    showErrorToast('No internet connection');
    return Promise.reject({ msg: 'No internet connection' });
  }

  config.headers = {
    'Content-Type': 'application/json; charset=utf-8',
    ...config.headers,
  };

  return config;
});

appAxios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.message === 'Network Error') {
      return axios(error.config);
    }
    return Promise.reject(error);
  },
);
