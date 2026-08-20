import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useDataStore from '../../state/dataStore';
import { POPULAR_SEARCHES, RECENT_SEARCHES } from '../../utils/mock';
import AnimatedListItem from '../../components/AnimatedListItem';
import BrandLogo from '../../components/BrandLogo';
import DealCard from '../../components/DealCard';
import EmptyState from '../../components/EmptyState';
import FilterChip from '../../components/FilterChip';
import PrimaryButton from '../../components/PrimaryButton';
import SearchBar from '../../components/SearchBar';
import TopAppBar from '../../components/TopAppBar';

const DISCOUNT_TIERS = [20, 50, 70];
const SORTS = ['Highest Discount', 'Newest', 'Expiring Soonest'];

const SearchScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const deals = useDataStore((state) => state.deals);
  const categories = useDataStore((state) => state.categories);
  const brands = useDataStore((state) => state.brands);
  const brandsById = useDataStore((state) => state.brandsById);

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(route.params?.category ?? null);
  const [minDiscount, setMinDiscount] = useState(null);
  const [sort, setSort] = useState('Highest Discount');
  const [showResults, setShowResults] = useState(Boolean(route.params?.category));

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
      list = [...list].sort((a, b) => (parseInt(b.discountLabel) || 0) * -1 - (parseInt(a.discountLabel) || 0) * -1);
    } else if (sort === 'Newest') {
      list = [...list].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    } else {
      list = [...list].sort((a, b) => new Date(a.expiresAt || '9999').getTime() - new Date(b.expiresAt || '9999').getTime());
    }
    return list;
  }, [deals, brandsById, query, selectedCategory, minDiscount, sort]);

  const showFilters = query.trim().length === 0 && !showResults;
  const suggestedBrands = useMemo(() => brands.slice(0, 2), [brands]);

  return (
    <View style={styles.container}>
      <TopAppBar showBack hideSearch hideProfile />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.four }]}
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
            <Text style={styles.groupLabel}>Category</Text>
            <View style={styles.chipRow}>
              <FilterChip label="All" selected={!selectedCategory} onPress={() => setSelectedCategory(null)} />
              {categories.slice(0, 6).map((c) => (
                <FilterChip
                  key={c.name}
                  label={c.name}
                  selected={selectedCategory === c.name}
                  onPress={() => setSelectedCategory(selectedCategory === c.name ? null : c.name)}
                />
              ))}
            </View>

            <Text style={styles.groupLabel}>Discount Range</Text>
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

            <Text style={styles.groupLabel}>Sort By</Text>
            <Pressable
              style={styles.sortBox}
              onPress={() => {
                const i = SORTS.indexOf(sort);
                setSort(SORTS[(i + 1) % SORTS.length]);
              }}>
              <Text style={styles.sortLabel}>{sort}</Text>
              <Icon name="chevron-down" size={18} color="#6B7280" />
            </Pressable>

            <PrimaryButton label={`Show Results (${filtered.length})`} style={styles.showResultsButton} onPress={() => setShowResults(true)} />

            {RECENT_SEARCHES.length > 0 && (
              <View style={styles.suggestionSection}>
                <Text style={styles.groupLabel}>Recent Searches</Text>
                <View style={styles.chipRow}>
                  {RECENT_SEARCHES.map((s) => (
                    <FilterChip key={s} label={s} onPress={() => setQuery(s)} />
                  ))}
                </View>
              </View>
            )}

            <View style={styles.suggestionSection}>
              <Text style={styles.groupLabel}>Popular Searches</Text>
              <View style={styles.chipRow}>
                {POPULAR_SEARCHES.map((s) => (
                  <FilterChip key={s} label={s} onPress={() => setQuery(s)} />
                ))}
              </View>
            </View>

            {suggestedBrands.length > 0 && (
              <View style={styles.suggestionSection}>
                <Text style={styles.groupLabel}>Suggested Brands</Text>
                <View style={styles.brandRow}>
                  {suggestedBrands.map((b) => (
                    <Pressable key={b.id} style={styles.brandChip} onPress={() => navigation.navigate('BrandDetailScreen', { id: b.id })}>
                      <BrandLogo initials={b.initials} size={40} tone="filled" />
                      <Text style={styles.brandChipLabel}>{b.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : filtered.length === 0 ? (
          <EmptyState icon="search-outline" title="No results" body="Try a different search term or clear your filters." />
        ) : (
          <View style={styles.results}>
            {filtered.map((deal, index) => (
              <AnimatedListItem key={deal.id} index={index}>
                <DealCard deal={deal} brand={brandsById[deal.brandId]} onPress={() => navigation.navigate('DealDetailScreen', { id: deal.id })} />
              </AnimatedListItem>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default SearchScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.four,
    paddingTop: SPACING.three,
    gap: SPACING.three,
  },
  groupLabel: {
    ...TYPOGRAPHY.headline,
    marginTop: SPACING.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.two,
  },
  sortBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F0DADA',
    borderRadius: RADIUS.button,
    paddingHorizontal: SPACING.three,
    paddingVertical: SPACING.three,
  },
  sortLabel: {
    ...TYPOGRAPHY.default,
  },
  showResultsButton: {
    marginTop: SPACING.two,
  },
  suggestionSection: {
    gap: SPACING.two,
    marginTop: SPACING.three,
  },
  brandRow: {
    flexDirection: 'row',
    gap: SPACING.three,
  },
  brandChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.two,
    borderWidth: 1,
    borderColor: '#F0DADA',
    borderRadius: RADIUS.card,
    paddingHorizontal: SPACING.three,
    paddingVertical: SPACING.two,
  },
  brandChipLabel: {
    ...TYPOGRAPHY.smallBold,
  },
  results: {
    gap: SPACING.three,
  },
});
