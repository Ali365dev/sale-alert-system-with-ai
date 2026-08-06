import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/dealpulse/empty-state';
import { FilterChip } from '@/components/dealpulse/filter-chip';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { AlertItem } from '@/types/dealpulse';

const ICON_BY_KIND: Record<AlertItem['kind'], keyof typeof Ionicons.glyphMap> = {
  'price-drop': 'heart',
  'new-brand': 'pricetag',
  'flash-sale': 'stopwatch',
};

const CIRCLE_BG: Record<AlertItem['kind'], string> = {
  'price-drop': '#DCEAFB',
  'new-brand': '#8A7A00',
  'flash-sale': '#FBDCDC',
};

const ICON_COLOR: Record<AlertItem['kind'], string> = {
  'price-drop': '#171717',
  'new-brand': '#FFFFFF',
  'flash-sale': '#B7131A',
};

const FILTERS = ['All Alerts', 'New Deals', 'Expiring Soon'] as const;

export default function AlertsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { alerts, refresh } = useAppData();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All Alerts');

  const visible = useMemo(() => {
    if (filter === 'New Deals') return alerts.filter((a) => !a.read);
    if (filter === 'Expiring Soon') return alerts.filter((a) => a.kind === 'flash-sale');
    return alerts;
  }, [alerts, filter]);

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
          data={visible}
          keyExtractor={(a) => a.id}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + BottomTabInset },
          ]}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="title">Notifications</ThemedText>
              <View style={styles.filterRow}>
                {FILTERS.map((f) => (
                  <FilterChip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const urgent = item.kind === 'flash-sale' && !item.read;
            return (
              <Pressable
                style={[styles.card, urgent && styles.cardUrgent]}
                onPress={() => item.brandId && router.push(`/brand/${item.brandId}`)}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: item.read ? '#EDEDED' : CIRCLE_BG[item.kind] },
                  ]}>
                  <Ionicons
                    name={item.read ? 'notifications' : ICON_BY_KIND[item.kind]}
                    size={18}
                    color={item.read ? '#9CA3AF' : ICON_COLOR[item.kind]}
                  />
                </View>
                <View style={styles.textBlock}>
                  <View style={styles.titleRow}>
                    <ThemedText
                      type="smallBold"
                      themeColor={item.read ? 'textSecondary' : 'text'}
                      numberOfLines={1}
                      style={styles.title}>
                      {item.title}
                    </ThemedText>
                    {urgent ? (
                      <View style={styles.timeBadge}>
                        <ThemedText type="label" style={styles.timeBadgeLabel}>
                          {item.time}
                        </ThemedText>
                      </View>
                    ) : (
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.time}
                      </ThemedText>
                    )}
                  </View>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                    {item.body}
                  </ThemedText>
                  {urgent && (
                    <ThemedText type="label" style={styles.viewDeal}>
                      VIEW DEAL
                    </ThemedText>
                  )}
                </View>
              </Pressable>
            );
          }}
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
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    gap: Spacing.three,
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  cardUrgent: {
    borderLeftWidth: 3,
    borderLeftColor: '#B7131A',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  timeBadge: {
    backgroundColor: '#DB322F',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.chip,
  },
  timeBadgeLabel: {
    color: '#FFFFFF',
    fontSize: 11,
  },
  viewDeal: {
    color: '#B7131A',
    marginTop: 2,
  },
});
