import { Stack } from 'expo-router';

import { CreateAlertProvider } from '@/state/alerts';

export default function CreateAlertLayout() {
  return (
    <CreateAlertProvider>
      <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />
    </CreateAlertProvider>
  );
}
