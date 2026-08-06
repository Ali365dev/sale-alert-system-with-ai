import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryCard } from '@/components/dealpulse/category-card';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { FilterChip } from '@/components/dealpulse/filter-chip';
import { SearchBar } from '@/components/dealpulse/search-bar';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Radius, Spacing } from '@/constants/theme';
import { useAppData } from '@/state/data';

const FILTERS = ['All Categories', 'Trending', 'Closing Soon'] as const;

export default function CategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { categories, deals, loading, refresh } = useAppData();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All Categories');

  const bestDiscount = useMemo(
    () => deals.reduce((max, d) => Math.max(max, d.isPercentageOff ? parseInt(d.discountLabel) || 0 : 0), 0),
    [deals]
  );

  const visible = useMemo(() => {
    let list = categories;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (filter === 'Trending') {
      list = [...list].sort((a, b) => b.dealCount - a.dealCount);
    }
    return list;
  }, [categories, query, filter]);

  if (!loading && categories.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <TopAppBar />
        <EmptyState
          icon="grid-outline"
          title="No categories yet"
          body="Categories appear here once your backend has tracked offers with a category."
          ctaLabel="Refresh"
          onPressCta={refresh}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <TopAppBar />
      <FlatList
        data={visible}
        keyExtractor={(c) => c.name}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + BottomTabInset },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search categories..." />
            <View style={styles.filterRow}>
              {FILTERS.map((f) => (
                <FilterChip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <CategoryCard
            category={item}
            onPress={() => router.push(`/search?category=${item.name}`)}
          />
        )}
        ListFooterComponent={
          <Pressable style={styles.banner} onPress={() => router.push('/search')}>
            <ThemedText type="headline" style={styles.bannerTitle}>
              Flash Sale Frenzy
            </ThemedText>
            <ThemedText type="small" style={styles.bannerBody}>
              {bestDiscount > 0
                ? `Up to ${bestDiscount}% off across all categories.`
                : 'Fresh deals land here as your backend tracks them.'}
            </ThemedText>
            <View style={styles.bannerCta}>
              <ThemedText type="label" style={styles.bannerCtaLabel}>
                Shop Now
              </ThemedText>
            </View>
          </Pressable>
        }
      />
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
  row: {
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  banner: {
    backgroundColor: '#B7131A',
    borderRadius: Radius.card,
    padding: Spacing.four,
    alignItems: 'center',
    marginTop: Spacing.three,
    gap: 4,
  },
  bannerTitle: {
    color: '#FFFFFF',
  },
  bannerBody: {
    color: '#F5D9D9',
    textAlign: 'center',
  },
  bannerCta: {
    backgroundColor: '#F5CB1B',
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    marginTop: Spacing.two,
  },
  bannerCtaLabel: {
    color: '#171717',
  },
});
