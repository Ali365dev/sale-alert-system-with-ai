import { appAxios } from './apiInterceptors';
import { getDeviceId } from '../utils/deviceId';

// Only include a field in the request if the caller actually passed it —
// the backend treats an omitted field as "leave unchanged", so a
// categories-only save (e.g. from the profile screen) must not wipe brands.
export const saveInterests = async ({ brands, categories } = {}) => {
  const body = { device_id: getDeviceId() };
  if (brands !== undefined) body.brands = brands;
  if (categories !== undefined) body.categories = categories;

  try {
    await appAxios.put('/preferences', body);
  } catch (error) {
    console.log('Failed to save interests:', error?.message);
  }
};

export const fetchInterests = async () => {
  try {
    const response = await appAxios.get('/preferences', { params: { device_id: getDeviceId() } });
    return { brands: response?.data?.brands ?? [], categories: response?.data?.categories ?? [] };
  } catch (error) {
    console.log('Failed to fetch interests:', error?.message);
    return null;
  }
};
