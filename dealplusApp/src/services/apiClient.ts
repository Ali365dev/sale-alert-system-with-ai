import axios from 'axios';

import { BASE_URL } from './config';

export const apiClient = axios.create({
  baseURL: BASE_URL,
});
