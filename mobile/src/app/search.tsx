import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomSheet } from '@/components/dealpulse/bottom-sheet';
import { DealCard } from '@/components/dealpulse/deal-card';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { FilterChip } from '@/components/dealpulse/filter-chip';
import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { SearchBar } from '@/components/dealpulse/search-bar';
import { SecondaryButton } from '@/components/dealpulse/secondary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { POPULAR_SEARCHES, RECENT_SEARCHES } from '@/data/mock';
import { useAppData } from '@/state/data';

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const { deals, categories, brands, brandsById } = useAppData();

  const [query, setQuery] = useState('');
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(params.category ?? null);
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  const [couponOnly, setCouponOnly] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter((deal) => {
      const brandName = brandsById[deal.brandId]?.name ?? '';
      if (q && !deal.title.toLowerCase().includes(q) && !brandName.toLowerCase().includes(q)) {
        return false;
      }
      if (selectedCategory && deal.category !== selectedCategory) return false;
      if (selectedBrandId && deal.brandId !== selectedBrandId) return false;
      if (couponOnly && !deal.promoCode) return false;
      return true;
    });
  }, [deals, brandsById, query, selectedCategory, selectedBrandId, couponOnly]);

  const showSuggestions = query.trim().length === 0;
  const activeFilterCount = [selectedCategory, selectedBrandId, couponOnly || null].filter(Boolean).length;

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={24} color="#171717" />
        </Pressable>
        <View style={styles.searchWrap}>
          <SearchBar value={query} onChangeText={setQuery} autoFocus />
        </View>
        <Pressable onPress={() => setFiltersVisible(true)} hitSlop={8} style={styles.filterButton}>
          <Ionicons name="options-outline" size={22} color="#171717" />
          {activeFilterCount > 0 && <View style={styles.filterDot} />}
        </Pressable>
      </View>

      {showSuggestions ? (
        <View style={styles.suggestions}>
          {RECENT_SEARCHES.length > 0 && (
            <View style={styles.suggestionSection}>
              <ThemedText type="smallBold">Recent Searches</ThemedText>
              <View style={styles.chipRow}>
                {RECENT_SEARCHES.map((s) => (
                  <FilterChip key={s} label={s} onPress={() => setQuery(s)} />
                ))}
              </View>
            </View>
          )}
          <View style={styles.suggestionSection}>
            <ThemedText type="smallBold">Popular Searches</ThemedText>
            <View style={styles.chipRow}>
              {POPULAR_SEARCHES.map((s) => (
                <FilterChip key={s} label={s} onPress={() => setQuery(s)} />
              ))}
            </View>
          </View>
          {brands.length > 0 && (
            <View style={styles.suggestionSection}>
              <ThemedText type="smallBold">Trending Brands</ThemedText>
              <View style={styles.chipRow}>
                {[...brands]
                  .sort((a, b) => b.dealCount - a.dealCount)
                  .slice(0, 6)
                  .map((b) => (
                    <FilterChip key={b.id} label={b.name} onPress={() => setQuery(b.name)} />
                  ))}
              </View>
            </View>
          )}
        </View>
      ) : results.length === 0 ? (
        <EmptyState icon="search-outline" title="No results" body="Try a different search term or clear your filters." />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(d) => d.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.results}
          renderItem={({ item }) => (
            <DealCard
              deal={item}
              brand={brandsById[item.brandId]}
              variant="grid"
              onPress={() => router.push(`/deal/${item.id}`)}
            />
          )}
        />
      )}

      <BottomSheet visible={filtersVisible} onClose={() => setFiltersVisible(false)}>
        <ThemedText type="headline" style={styles.sheetTitle}>
          Filters
        </ThemedText>

        <ThemedText type="smallBold" style={styles.groupLabel}>
          Category
        </ThemedText>
        <View style={styles.chipRow}>
          {categories.map((c) => (
            <FilterChip
              key={c.name}
              label={c.name}
              selected={selectedCategory === c.name}
              onPress={() => setSelectedCategory(selectedCategory === c.name ? null : c.name)}
            />
          ))}
        </View>

        <ThemedText type="smallBold" style={styles.groupLabel}>
          Brand
        </ThemedText>
        <View style={styles.chipRow}>
          {brands.map((b) => (
            <FilterChip
              key={b.id}
              label={b.name}
              selected={selectedBrandId === b.id}
              onPress={() => setSelectedBrandId(selectedBrandId === b.id ? null : b.id)}
            />
          ))}
        </View>

        <ThemedText type="smallBold" style={styles.groupLabel}>
          Coupon Available
        </ThemedText>
        <View style={styles.chipRow}>
          <FilterChip label="Has coupon code" selected={couponOnly} onPress={() => setCouponOnly((v) => !v)} />
        </View>

        <View style={styles.sheetActions}>
          <SecondaryButton
            label="Reset"
            style={styles.sheetActionButton}
            onPress={() => {
              setSelectedCategory(null);
              setSelectedBrandId(null);
              setCouponOnly(false);
            }}
          />
          <PrimaryButton
            label="Apply"
            style={styles.sheetActionButton}
            onPress={() => setFiltersVisible(false)}
          />
        </View>
      </BottomSheet>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.three,
  },
  searchWrap: {
    flex: 1,
  },
  filterButton: {
    position: 'relative',
  },
  filterDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E7000B',
  },
  suggestions: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  suggestionSection: {
    gap: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  results: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  sheetTitle: {
    marginBottom: Spacing.three,
  },
  groupLabel: {
    marginTop: Spacing.three,
    marginBottom: Spacing.two,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.five,
  },
  sheetActionButton: {
    flex: 1,
  },
});
