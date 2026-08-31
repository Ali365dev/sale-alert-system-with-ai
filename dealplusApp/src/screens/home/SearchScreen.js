import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import { RECENT_SEARCHES } from '../../utils/mock';
import { isCloseToBottom } from '../../utils/scroll';
import { usePagination } from '../../hooks/usePagination';
import AnimatedListItem from '../../components/AnimatedListItem';
import PaginationLoader from '../../components/PaginationLoader';
import DealCard from '../../components/DealCard';
import EmptyState from '../../components/EmptyState';
import PrimaryButton from '../../components/PrimaryButton';
import SearchBar from '../../components/SearchBar';

const DISCOUNT_TIERS = [20, 50, 70];
const SORTS = ['Highest Discount', 'Newest', 'Expiring Soonest'];

const CATEGORY_ICONS = [
  { match: /fashion|apparel|clothing|retail/i, icon: 'shirt-outline' },
  { match: /men/i, icon: 'body-outline' },
  { match: /electronic|software|tech/i, icon: 'laptop-outline' },
  { match: /beauty|cosmetic|personal care|skincare/i, icon: 'flask-outline' },
  { match: /food|restaurant|grocery|dining/i, icon: 'restaurant-outline' },
  { match: /travel/i, icon: 'airplane-outline' },
  { match: /sport|fitness|outdoor/i, icon: 'football-outline' },
  { match: /home|furniture|garden/i, icon: 'home-outline' },
  { match: /footwear|shoe/i, icon: 'footsteps-outline' },
];
const iconForCategory = (name) => CATEGORY_ICONS.find((c) => c.match.test(name))?.icon ?? 'pricetag-outline';

function CategoryChip({ label, icon, selected, onPress, colors, styles }) {
  return (
    <Pressable style={[styles.categoryChip, selected && styles.categoryChipSelected]} onPress={onPress}>
      <Icon name={icon} size={15} color={selected ? '#FFFFFF' : colors.primary} />
      <Text style={[styles.categoryChipLabel, selected && styles.categoryChipLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

function DiscountCard({ tier, selected, onPress, colors, styles }) {
  return (
    <Pressable style={[styles.discountCard, selected && styles.discountCardSelected]} onPress={onPress}>
      <View style={[styles.discountIconBadge, selected && styles.discountIconBadgeSelected]}>
        <Icon name="pricetag" size={16} color={selected ? '#FFFFFF' : colors.primary} />
      </View>
      <Text style={styles.discountTierLabel}>{tier}%+</Text>
      <Text style={styles.discountTierSub}>Deals</Text>
    </Pressable>
  );
}

const SearchScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const deals = useDataStore((state) => state.deals);
  const categories = useDataStore((state) => state.categories);
  const brandsById = useDataStore((state) => state.brandsById);

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(route.params?.category ?? null);
  const [minDiscount, setMinDiscount] = useState(null);
  const [sort, setSort] = useState('Highest Discount');
  const [sortOpen, setSortOpen] = useState(false);
  const [showResults, setShowResults] = useState(Boolean(route.params?.category));
  const [recentSearches, setRecentSearches] = useState(RECENT_SEARCHES);

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
      list = [...list].sort((a, b) => (parseInt(a.discountLabel) || 0) - (parseInt(b.discountLabel) || 0));
    } else if (sort === 'Newest') {
      list = [...list].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    } else {
      list = [...list].sort((a, b) => new Date(a.expiresAt || '9999').getTime() - new Date(b.expiresAt || '9999').getTime());
    }
    return list;
  }, [deals, brandsById, query, selectedCategory, minDiscount, sort]);

  const showFilters = query.trim().length === 0 && !showResults;
  const previewCategories = useMemo(() => categories.slice(0, 6), [categories]);
  const { visibleItems: visibleDeals, isLoadingMore, loadMore } = usePagination(filtered);

  const goBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Deals');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.three }]}>
        <Pressable onPress={goBack} hitSlop={8}>
          <Icon name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>DealPulse</Text>
        <Pressable style={styles.filterButton} onPress={() => setShowResults(false)} hitSlop={4}>
          <Icon name="filter" size={17} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.four }]}
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => isCloseToBottom(nativeEvent) && loadMore()}
        scrollEventThrottle={200}>
        <SearchBar
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setShowResults(false);
          }}
          placeholder="Search deals, brands, categories..."
          showMic
        />

        {showFilters ? (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Categories</Text>
              <Pressable onPress={() => navigation.navigate('Deals')} hitSlop={8}>
                <Text style={styles.sectionLink}>View All</Text>
              </Pressable>
            </View>
            <View style={styles.chipRow}>
              <CategoryChip label="All" icon="grid" selected={!selectedCategory} onPress={() => setSelectedCategory(null)} colors={colors} styles={styles} />
              {previewCategories.map((c) => (
                <CategoryChip
                  key={c.name}
                  label={c.name}
                  icon={iconForCategory(c.name)}
                  selected={selectedCategory === c.name}
                  onPress={() => setSelectedCategory(selectedCategory === c.name ? null : c.name)}
                  colors={colors}
                  styles={styles}
                />
              ))}
            </View>

            <Text style={styles.sectionTitle}>Discount Range</Text>
            <View style={styles.discountGrid}>
              {DISCOUNT_TIERS.map((tier) => (
                <DiscountCard
                  key={tier}
                  tier={tier}
                  selected={minDiscount === tier}
                  onPress={() => setMinDiscount(minDiscount === tier ? null : tier)}
                  colors={colors}
                  styles={styles}
                />
              ))}
            </View>

            <Text style={styles.sectionTitle}>Sort By</Text>
            <View style={styles.sortWrap}>
              <Pressable style={styles.sortBox} onPress={() => setSortOpen((o) => !o)}>
                <View style={styles.sortIconBadge}>
                  <Icon name="swap-vertical" size={15} color={colors.primary} />
                </View>
                <Text style={styles.sortLabel}>{sort}</Text>
                <Icon name={sortOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
              </Pressable>
              {sortOpen && (
                <View style={styles.sortDropdown}>
                  {SORTS.map((option, index) => (
                    <Pressable
                      key={option}
                      style={[styles.sortDropdownItem, index === SORTS.length - 1 && styles.sortDropdownItemLast]}
                      onPress={() => {
                        setSort(option);
                        setSortOpen(false);
                      }}>
                      <Text style={styles.sortDropdownItemLabel}>{option}</Text>
                      {sort === option && <Icon name="checkmark" size={16} color={colors.primary} />}
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <PrimaryButton
              label={`Show Results (${filtered.length})`}
              icon="search"
              pill
              style={styles.showResultsButton}
              onPress={() => setShowResults(true)}
            />

            {recentSearches.length > 0 && (
              <View style={styles.suggestionSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Recent Searches</Text>
                  <Pressable onPress={() => setRecentSearches([])} hitSlop={8}>
                    <Text style={styles.sectionLink}>Clear All</Text>
                  </Pressable>
                </View>
                <View style={styles.chipRow}>
                  {recentSearches.map((s) => (
                    <View key={s} style={styles.recentChip}>
                      <Icon name="time-outline" size={14} color={colors.textSecondary} />
                      <Pressable onPress={() => setQuery(s)}>
                        <Text style={styles.recentChipLabel}>{s}</Text>
                      </Pressable>
                      <Pressable onPress={() => setRecentSearches((prev) => prev.filter((item) => item !== s))} hitSlop={8}>
                        <Icon name="close" size={14} color={colors.textSecondary} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        ) : filtered.length === 0 ? (
          <EmptyState icon="search-outline" title="No results" body="Try a different search term or clear your filters." />
        ) : (
          <>
            {selectedCategory && (
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
            )}

            <View style={styles.results}>
              {visibleDeals.map((deal, index) => {
                const tag = `search-${deal.id}`;
                return (
                  <AnimatedListItem key={deal.id} index={index}>
                    <DealCard
                      deal={deal}
                      brand={brandsById[deal.brandId]}
                      transitionTag={tag}
                      onPress={() => navigation.navigate('DealDetailScreen', { id: deal.id, transitionTag: tag })}
                    />
                  </AnimatedListItem>
                );
              })}
              {isLoadingMore && <PaginationLoader />}
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
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.four,
      paddingBottom: SPACING.three,
    },
    headerTitle: {
      ...TYPOGRAPHY.headline,
      color: colors.primary,
    },
    filterButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.three,
      gap: SPACING.three,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: SPACING.two,
    },
    sectionTitle: {
      ...TYPOGRAPHY.headline,
      color: colors.text,
      marginTop: SPACING.two,
    },
    sectionLink: {
      ...TYPOGRAPHY.linkPrimary,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.two,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: RADIUS.chip,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two,
      backgroundColor: colors.surface,
    },
    categoryChipSelected: {
      backgroundColor: colors.primary,
    },
    categoryChipLabel: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
    },
    categoryChipLabelSelected: {
      color: '#FFFFFF',
    },
    discountGrid: {
      flexDirection: 'row',
      gap: SPACING.two,
    },
    discountCard: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.card,
      paddingVertical: SPACING.three,
    },
    discountCardSelected: {
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    discountIconBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.errorTint,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    discountIconBadgeSelected: {
      backgroundColor: colors.primary,
    },
    discountTierLabel: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
      fontSize: 15,
    },
    discountTierSub: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    sortWrap: {
      zIndex: 10,
    },
    sortBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.button,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two,
    },
    sortIconBadge: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.errorTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sortLabel: {
      ...TYPOGRAPHY.default,
      color: colors.text,
      flex: 1,
    },
    sortDropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      marginTop: SPACING.one,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.button,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    sortDropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.three,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sortDropdownItemLast: {
      borderBottomWidth: 0,
    },
    sortDropdownItemLabel: {
      ...TYPOGRAPHY.small,
      color: colors.text,
    },
    showResultsButton: {
      marginTop: SPACING.two,
    },
    suggestionSection: {
      gap: SPACING.two,
      marginTop: SPACING.three,
    },
    recentChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.chip,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two,
    },
    recentChipLabel: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
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
