import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/dealpulse/empty-state';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { AlertItem } from '@/types/dealpulse';

const ICON_BY_KIND: Record<AlertItem['kind'], keyof typeof Ionicons.glyphMap> = {
  'price-drop': 'trending-down',
  'new-brand': 'sparkles',
  'flash-sale': 'flash',
};

export default function AlertsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { alerts, refresh } = useAppData();

  return (
    <ThemedView style={styles.container}>
      <TopAppBar />
      {alerts.length === 0 ? (
        <EmptyState
          icon="notifications-outline"
          title="No alerts yet"
          body="Once your backend tracks new offers, flash sales and new-brand alerts will show up here."
          ctaLabel="Refresh"
          onPressCta={refresh}
        />
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + BottomTabInset },
          ]}
          ListHeaderComponent={
            <ThemedText type="title" style={styles.title}>
              Alerts
            </ThemedText>
          }
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => item.brandId && router.push(`/brand/${item.brandId}`)}>
              <View style={[styles.iconCircle, !item.read && styles.iconCircleUnread]}>
                <Ionicons
                  name={ICON_BY_KIND[item.kind]}
                  size={18}
                  color={item.read ? '#171717' : '#E7000B'}
                />
              </View>
              <View style={styles.textBlock}>
                <ThemedText type="smallBold">{item.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {item.body}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.time}>
                  {item.time}
                </ThemedText>
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </Pressable>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  title: {
    marginBottom: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleUnread: {
    backgroundColor: '#FEE2E2',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  time: {
    marginTop: 2,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E7000B',
    marginTop: Spacing.two,
  },
});
