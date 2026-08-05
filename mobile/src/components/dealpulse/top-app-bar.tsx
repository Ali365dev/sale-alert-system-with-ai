import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface Props {
  showBack?: boolean;
  onBack?: () => void;
  hideSearch?: boolean;
  hideProfile?: boolean;
}

export function TopAppBar({ showBack, onBack, hideSearch, hideProfile }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.side}>
        {showBack && (
          <Pressable hitSlop={8} onPress={onBack ?? (() => router.back())}>
            <Ionicons name="chevron-back" size={24} color="#171717" />
          </Pressable>
        )}
      </View>

      <ThemedText type="headline" style={styles.wordmark}>
        DealPulse
      </ThemedText>

      <View style={[styles.side, styles.sideRight]}>
        {!hideSearch && (
          <Pressable hitSlop={8} onPress={() => router.push('/search')}>
            <Ionicons name="search" size={22} color="#171717" />
          </Pressable>
        )}
        {!hideProfile && (
          <Pressable hitSlop={8} onPress={() => router.push('/(tabs)/profile')}>
            <Ionicons name="person-circle-outline" size={24} color="#171717" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    backgroundColor: '#FFFFFF',
  },
  side: {
    width: 60,
    flexDirection: 'row',
    gap: Spacing.three,
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  wordmark: {
    flex: 1,
    textAlign: 'center',
  },
});
