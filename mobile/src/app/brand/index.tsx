import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/dealpulse/empty-state';
import { FilterChip } from '@/components/dealpulse/filter-chip';
import { SearchBar } from '@/components/dealpulse/search-bar';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';
import { Brand } from '@/types/dealpulse';

const FILTERS = ['All', 'Trending', 'Newly Added', 'Expiring Soon'] as const;

export default function BrandDirectoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { brands, deals, loading, refresh } = useAppData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');

  const bestDiscountByBrand = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of deals) {
      if (!d.isPercentageOff) continue;
      const pct = Math.abs(parseInt(d.discountLabel) || 0);
      map.set(d.brandId, Math.max(map.get(d.brandId) ?? 0, pct));
    }
    return map;
  }, [deals]);

  const isNewBrand = (brand: Brand) => {
    const brandDeals = deals.filter((d) => d.brandId === brand.id);
    return brandDeals.some((d) => {
      if (!d.createdAt) return false;
      return (Date.now() - new Date(d.createdAt).getTime()) / 86400000 <= 3;
    });
  };

  const filtered = useMemo(() => {
    let list = [...brands];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((b) => b.name.toLowerCase().includes(q));
    }
    if (filter === 'Trending') {
      list.sort((a, b) => b.dealCount - a.dealCount);
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [brands, query, filter]);

  return (
    <ThemedView style={styles.container}>
      <TopAppBar showBack hideSearch />

      {!loading && brands.length === 0 ? (
        <EmptyState
          icon="business-outline"
          title="No brands tracked yet"
          body="Brands you track in your backend will show up here."
          ctaLabel="Refresh"
          onPressCta={refresh}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
          ListHeaderComponent={
            <View style={styles.header}>
              <ThemedText type="title">Top Brands</ThemedText>
              <SearchBar value={query} onChangeText={setQuery} placeholder="Search brands" />
              <View style={styles.filterRow}>
                {FILTERS.map((f) => (
                  <FilterChip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
                ))}
              </View>
            </View>
          }
          renderItem={({ item }) => {
            const discount = bestDiscountByBrand.get(item.id);
            return (
              <Pressable style={styles.card} onPress={() => router.push(`/brand/${item.id}`)}>
                <View style={styles.imageWrap}>
                  <Image source={{ uri: item.coverImage }} style={styles.image} contentFit="cover" />
                  {isNewBrand(item) && (
                    <View style={styles.newBadge}>
                      <ThemedText type="label" style={styles.newBadgeLabel}>
                        NEWEST DEALS
                      </ThemedText>
                    </View>
                  )}
                  <View style={styles.heartButton}>
                    <Ionicons name="heart-outline" size={16} color="#171717" />
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {item.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {item.category}
                  </ThemedText>
                  {discount ? (
                    <ThemedText type="smallBold" style={styles.discountLabel}>
                      UP TO {discount}% OFF
                    </ThemedText>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.dealCount} deals
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
  header: {
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  row: {
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  card: {
    width: '48%',
    marginBottom: Spacing.three,
    borderRadius: Radius.card,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DADA',
  },
  imageWrap: {
    width: '100%',
    aspectRatio: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  newBadge: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    backgroundColor: '#F5CB1B',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: 4,
  },
  newBadgeLabel: {
    fontSize: 10,
    color: '#171717',
  },
  heartButton: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: Spacing.three,
    gap: 2,
  },
  discountLabel: {
    color: '#B7131A',
  },
});
