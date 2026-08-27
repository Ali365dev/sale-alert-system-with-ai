import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from './storage';

/** Local, per-device toggles for which kinds of alerts the user wants — layered
 * on top of the followed brands/categories that decide *which* offers match
 * (see preferencesStore). Push permission itself is a separate OS-level grant
 * handled by pushNotifications.js. */
const useNotificationPrefsStore = create()(
  persist(
    (set) => ({
      pushEnabled: true,
      newDealsFromFollowedBrands: true,
      priceDropAlerts: true,
      expiringSoonReminders: true,
      weeklyDigest: false,
      setPref: (key, value) => set({ [key]: value }),
    }),
    {
      name: 'notification-prefs-storage',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);

export default useNotificationPrefsStore;
