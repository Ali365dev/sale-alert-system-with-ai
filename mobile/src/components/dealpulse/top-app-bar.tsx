import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

interface Props {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  hideSearch?: boolean;
  hideProfile?: boolean;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onPressRight?: () => void;
}

export function TopAppBar({
  title = 'DealPulse',
  showBack,
  onBack,
  hideSearch,
  hideProfile,
  rightIcon,
  onPressRight,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + Spacing.two }]}>
      <View style={styles.side}>
        {showBack ? (
          <Pressable hitSlop={8} onPress={onBack ?? (() => router.back())}>
            <Ionicons name="chevron-back" size={24} color="#171717" />
          </Pressable>
        ) : (
          !hideSearch && (
            <Pressable hitSlop={8} onPress={() => router.push('/search')}>
              <Ionicons name="search" size={22} color="#B7131A" />
            </Pressable>
          )
        )}
      </View>

      <ThemedText type="headline" style={styles.wordmark}>
        {title}
      </ThemedText>

      <View style={[styles.side, styles.sideRight]}>
        {rightIcon ? (
          <Pressable hitSlop={8} onPress={onPressRight}>
            <Ionicons name={rightIcon} size={22} color="#171717" />
          </Pressable>
        ) : (
          !hideProfile && (
            <Pressable hitSlop={8} onPress={() => router.push('/(tabs)/profile')}>
              <Ionicons name="person-circle-outline" size={24} color="#B7131A" />
            </Pressable>
          )
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
    borderBottomWidth: 1,
    borderBottomColor: '#F0DADA',
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
    color: '#B7131A',
  },
});
