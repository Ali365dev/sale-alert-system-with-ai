import { appAxios } from './apiInterceptors';
import { getDeviceId } from '../utils/deviceId';

export const requestBrand = async ({ brandName, category, note } = {}) => {
  try {
    await appAxios.post('/brand-requests', {
      device_id: getDeviceId(),
      brand_name: brandName,
      category: category || undefined,
      note: note || undefined,
    });
    return true;
  } catch (error) {
    console.log('Failed to request brand:', error?.message);
    return false;
  }
};
