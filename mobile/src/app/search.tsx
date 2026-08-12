import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedListItem } from '@/components/dealpulse/animated-list-item';
import { BrandLogo } from '@/components/dealpulse/brand-logo';
import { DealCard } from '@/components/dealpulse/deal-card';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { FilterChip } from '@/components/dealpulse/filter-chip';
import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { SearchBar } from '@/components/dealpulse/search-bar';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { POPULAR_SEARCHES, RECENT_SEARCHES } from '@/data/mock';
import { useAppData } from '@/state/data';

const DISCOUNT_TIERS = [20, 50, 70];
const SORTS = ['Highest Discount', 'Newest', 'Expiring Soonest'] as const;

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const { deals, categories, brands, brandsById } = useAppData();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(params.category ?? null);
  const [minDiscount, setMinDiscount] = useState<number | null>(null);
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Highest Discount');
  const [showResults, setShowResults] = useState(Boolean(params.category));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = deals.filter((deal) => {
      const brandName = brandsById[deal.brandId]?.name ?? '';
      if (q && !deal.title.toLowerCase().includes(q) && !brandName.toLowerCase().includes(q)) {
        return false;
      }
      if (selectedCategory && deal.category !== selectedCategory) return false;
      if (minDiscount) {
        const pct = deal.isPercentageOff ? parseInt(deal.discountLabel) || 0 : 0;
        if (Math.abs(pct) < minDiscount) return false;
      }
      return true;
    });
    if (sort === 'Highest Discount') {
      list = [...list].sort(
        (a, b) => (parseInt(b.discountLabel) || 0) * -1 - (parseInt(a.discountLabel) || 0) * -1
      );
    } else if (sort === 'Newest') {
      list = [...list].sort(
        (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      );
    } else {
      list = [...list].sort(
        (a, b) => new Date(a.expiresAt || '9999').getTime() - new Date(b.expiresAt || '9999').getTime()
      );
    }
    return list;
  }, [deals, brandsById, query, selectedCategory, minDiscount, sort]);

  const showFilters = query.trim().length === 0 && !showResults;
  const suggestedBrands = useMemo(() => brands.slice(0, 2), [brands]);

  return (
    <ThemedView style={styles.container}>
      <TopAppBar showBack hideSearch hideProfile />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
        showsVerticalScrollIndicator={false}>
        <SearchBar
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setShowResults(false);
          }}
          placeholder="Search deals, brands, categories."
          showMic
        />

        {showFilters ? (
          <>
            <ThemedText type="headline" style={styles.groupLabel}>
              Category
            </ThemedText>
            <View style={styles.chipRow}>
              <FilterChip
                label="All"
                selected={!selectedCategory}
                onPress={() => setSelectedCategory(null)}
              />
              {categories.slice(0, 6).map((c) => (
                <FilterChip
                  key={c.name}
                  label={c.name}
                  selected={selectedCategory === c.name}
                  onPress={() => setSelectedCategory(selectedCategory === c.name ? null : c.name)}
                />
              ))}
            </View>

            <ThemedText type="headline" style={styles.groupLabel}>
              Discount Range
            </ThemedText>
            <View style={styles.chipRow}>
              {DISCOUNT_TIERS.map((tier) => (
                <FilterChip
                  key={tier}
                  label={`${tier}%+`}
                  selected={minDiscount === tier}
                  onPress={() => setMinDiscount(minDiscount === tier ? null : tier)}
                />
              ))}
            </View>

            <ThemedText type="headline" style={styles.groupLabel}>
              Sort By
            </ThemedText>
            <Pressable
              style={styles.sortBox}
              onPress={() => {
                const i = SORTS.indexOf(sort);
                setSort(SORTS[(i + 1) % SORTS.length]);
              }}>
              <ThemedText type="default">{sort}</ThemedText>
              <Ionicons name="chevron-down" size={18} color="#6B7280" />
            </Pressable>

            <PrimaryButton
              label={`Show Results (${filtered.length})`}
              style={styles.showResultsButton}
              onPress={() => setShowResults(true)}
            />

            {RECENT_SEARCHES.length > 0 && (
              <View style={styles.suggestionSection}>
                <ThemedText type="headline">Recent Searches</ThemedText>
                <View style={styles.chipRow}>
                  {RECENT_SEARCHES.map((s) => (
                    <FilterChip key={s} label={s} onPress={() => setQuery(s)} />
                  ))}
                </View>
              </View>
            )}

            <View style={styles.suggestionSection}>
              <ThemedText type="headline">Popular Searches</ThemedText>
              <View style={styles.chipRow}>
                {POPULAR_SEARCHES.map((s) => (
                  <FilterChip key={s} label={s} onPress={() => setQuery(s)} />
                ))}
              </View>
            </View>

            {suggestedBrands.length > 0 && (
              <View style={styles.suggestionSection}>
                <ThemedText type="headline">Suggested Brands</ThemedText>
                <View style={styles.brandRow}>
                  {suggestedBrands.map((b) => (
                    <Pressable
                      key={b.id}
                      style={styles.brandChip}
                      onPress={() => router.push(`/brand/${b.id}`)}>
                      <BrandLogo initials={b.initials} size={40} tone="filled" />
                      <ThemedText type="smallBold">{b.name}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="No results"
            body="Try a different search term or clear your filters."
          />
        ) : (
          <View style={styles.results}>
            {filtered.map((deal, index) => (
              <AnimatedListItem key={deal.id} index={index}>
                <DealCard deal={deal} brand={brandsById[deal.brandId]} onPress={() => router.push(`/deal/${deal.id}`)} />
              </AnimatedListItem>
            ))}
          </View>
        )}
      </ScrollView>
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
  groupLabel: {
    marginTop: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  sortBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F0DADA',
    borderRadius: Radius.button,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  showResultsButton: {
    marginTop: Spacing.two,
  },
  suggestionSection: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  brandRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#F0DADA',
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  results: {
    gap: Spacing.three,
  },
});
