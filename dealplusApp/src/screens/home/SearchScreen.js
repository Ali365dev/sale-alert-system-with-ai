import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import useSearchHistoryStore from '../../state/searchHistoryStore';
import { isCloseToBottom } from '../../utils/scroll';
import { usePagination } from '../../hooks/usePagination';
import AnimatedListItem from '../../components/AnimatedListItem';
import BrandLogo from '../../components/BrandLogo';
import DealCard from '../../components/DealCard';
import EmptyState from '../../components/EmptyState';
import PaginationLoader from '../../components/PaginationLoader';
import SearchBar from '../../components/SearchBar';

const codeLabel = (count) => {
  const n = Number(count) || 0;
  if (n <= 0) return null;
  return `${n} ${n === 1 ? 'Code' : 'Codes'}`;
};

const SearchScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const deals = useDataStore((state) => state.deals);
  const brands = useDataStore((state) => state.brands);
  const brandsById = useDataStore((state) => state.brandsById);

  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(Boolean(route.params?.category));
  const [selectedCategory, setSelectedCategory] = useState(route.params?.category ?? null);
  const recentSearches = useSearchHistoryStore((state) => state.recentSearches);
  const rememberSearch = useSearchHistoryStore((state) => state.rememberSearch);
  const clearSearches = useSearchHistoryStore((state) => state.clearSearches);
  const [storeSearches, setStoreSearches] = useState([]);

  const popularStores = useMemo(
    () => [...brands].sort((a, b) => (b.dealCount || 0) - (a.dealCount || 0) || a.name.localeCompare(b.name)).slice(0, 12),
    [brands],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals.filter((deal) => {
      const brand = brandsById[deal.brandId];
      const haystack = [deal.title, deal.description, deal.promoCode, deal.category, brand?.name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (selectedCategory && deal.category !== selectedCategory) return false;
      return true;
    });
  }, [deals, brandsById, query, selectedCategory]);

  const { visibleItems: visibleDeals, isLoadingMore, loadMore } = usePagination(filtered);
  const idle = !showResults;

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('CategoriesScreen');
  };

  const rememberStore = (brand) => {
    if (!brand?.id) return;
    setStoreSearches((prev) => [brand, ...prev.filter((b) => b.id !== brand.id)].slice(0, 8));
  };

  const runSearch = (term = query) => {
    const next = (term ?? '').trim();
    setQuery(next);
    if (next) rememberSearch(next);
    setShowResults(true);
  };

  const openBrand = (brand) => {
    if (!brand?.id) return;
    rememberStore(brand);
    navigation.navigate('BrandDetailScreen', { id: brand.id });
  };

  const onRecentPress = (term) => {
    setQuery(term);
    runSearch(term);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.two }]}>
        <Pressable onPress={goBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="chevron-back" size={26} color={colors.text} />
        </Pressable>
        <SearchBar
          style={styles.searchField}
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            if (!t.trim()) {
              setShowResults(false);
              setSelectedCategory(null);
            }
          }}
          placeholder="Search stores & deals"
          autoFocus
          onSubmitEditing={() => runSearch()}
        />
        <Pressable style={styles.searchButton} onPress={() => runSearch()} accessibilityRole="button">
          <Text style={styles.searchButtonLabel}>Search</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.four }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={({ nativeEvent }) => !idle && isCloseToBottom(nativeEvent) && loadMore()}
        scrollEventThrottle={200}>
        {idle ? (
          <>
            {recentSearches.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Recent Searches</Text>
                  <Pressable onPress={clearSearches} hitSlop={8}>
                    <Text style={styles.clearLink}>Clear</Text>
                  </Pressable>
                </View>
                <View style={styles.chipRow}>
                  {recentSearches.map((term) => (
                    <Pressable key={term} style={styles.chip} onPress={() => onRecentPress(term)}>
                      <Text style={styles.chipLabel}>{term}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {storeSearches.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Store Searches</Text>
                  <Pressable onPress={() => setStoreSearches([])} hitSlop={8}>
                    <Text style={styles.clearLink}>Clear</Text>
                  </Pressable>
                </View>
                <View style={styles.chipRow}>
                  {storeSearches.map((brand) => (
                    <Pressable key={brand.id} style={styles.storeChip} onPress={() => openBrand(brand)}>
                      <BrandLogo brand={brand} size={22} tone="filled" />
                      <Text style={styles.chipLabel} numberOfLines={1}>
                        {brand.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Popular stores</Text>
              {popularStores.length === 0 ? (
                <EmptyState icon="storefront-outline" title="No stores yet" body="Stores will show up here once deals load." />
              ) : (
                <View style={styles.storeList}>
                  {popularStores.map((brand, index) => {
                    const codes = codeLabel(brand.dealCount);
                    return (
                      <Pressable
                        key={brand.id}
                        style={[styles.storeRow, index === popularStores.length - 1 && styles.storeRowLast]}
                        onPress={() => openBrand(brand)}>
                        <BrandLogo brand={brand} size={36} tone="filled" />
                        <Text style={styles.storeName} numberOfLines={1}>
                          {brand.name}
                        </Text>
                        {codes ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeLabel}>{codes}</Text>
                          </View>
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        ) : filtered.length === 0 ? (
          <EmptyState icon="search-outline" title="No results" body="Try a different search term." />
        ) : (
          <>
            {selectedCategory ? (
              <View style={styles.activeFilterRow}>
                <Text style={styles.activeFilterLabel}>Showing:</Text>
                <Pressable
                  style={styles.activeFilterChip}
                  onPress={() => {
                    setSelectedCategory(null);
                    setShowResults(false);
                  }}>
                  <Text style={styles.activeFilterChipLabel}>{selectedCategory}</Text>
                  <Icon name="close" size={14} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.results}>
              {visibleDeals.map((deal, index) => {
                const tag = `search-${deal.id}`;
                return (
                  <AnimatedListItem key={deal.id} index={index}>
                    <DealCard
                      variant="offer"
                      deal={deal}
                      brand={brandsById[deal.brandId]}
                      transitionTag={tag}
                      onPress={() => navigation.navigate('DealDetailScreen', { id: deal.id, transitionTag: tag })}
                    />
                  </AnimatedListItem>
                );
              })}
              {isLoadingMore ? <PaginationLoader /> : null}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default SearchScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      paddingHorizontal: SPACING.three,
      paddingBottom: SPACING.three,
      backgroundColor: colors.surface,
    },
    searchField: {
      flex: 1,
      height: 42,
      backgroundColor: colors.backgroundElement,
    },
    searchButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingHorizontal: 14,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchButtonLabel: {
      ...TYPOGRAPHY.smallBold,
      color: colors.white,
      fontSize: 15,
    },
    content: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.three,
      gap: SPACING.four,
    },
    section: {
      gap: SPACING.three,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: {
      ...TYPOGRAPHY.subtitle,
      color: colors.text,
      fontSize: 17,
    },
    clearLink: {
      ...TYPOGRAPHY.small,
      color: colors.mutedInk,
      fontWeight: '500',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.two,
    },
    chip: {
      backgroundColor: colors.backgroundElement,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    storeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.backgroundElement,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      maxWidth: '100%',
    },
    chipLabel: {
      ...TYPOGRAPHY.small,
      color: colors.text,
      fontWeight: '500',
    },
    storeList: {
      marginTop: SPACING.one,
    },
    storeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.three,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    storeRowLast: {
      borderBottomWidth: 0,
    },
    storeName: {
      ...TYPOGRAPHY.default,
      color: colors.text,
      flex: 1,
      fontWeight: '500',
    },
    badge: {
      backgroundColor: colors.backgroundElement,
      borderRadius: RADIUS.chip,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    badgeLabel: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
    },
    results: {
      gap: SPACING.three,
    },
    activeFilterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
    },
    activeFilterLabel: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    activeFilterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.chip,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two,
    },
    activeFilterChipLabel: {
      ...TYPOGRAPHY.smallBold,
      color: '#FFFFFF',
    },
  });
