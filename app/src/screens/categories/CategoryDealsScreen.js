import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '../../components/Screen';
import Icon from 'react-native-vector-icons/Ionicons';
import { SCREEN_WIDTH, SPACING } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import { usePagination } from '../../hooks/usePagination';
import AnimatedListItem from '../../components/AnimatedListItem';
import CouponCard from '../../components/CouponCard';
import EmptyState from '../../components/EmptyState';
import PaginationLoader from '../../components/PaginationLoader';
import SearchBar from '../../components/SearchBar';
import TopAppBar from '../../components/TopAppBar';
import ViewSwitcher from '../../components/ViewSwitcher';
import useViewMode from '../../hooks/useViewMode';

const GRID_PAD = 20;
const GRID_GAP = 12;
const CARD_W = (SCREEN_WIDTH - GRID_PAD * 2 - GRID_GAP) / 2;

const SORTS = [
  { key: 'discount', label: 'Top discount', icon: 'flame-outline' },
  { key: 'newest', label: 'Newest', icon: 'sparkles-outline' },
  { key: 'ending', label: 'Ending soon', icon: 'time-outline' },
];

const discountValue = (deal) => Math.abs(parseFloat(String(deal.discountLabel || '').replace(/[^0-9.-]/g, ''))) || 0;
const isExpired = (deal) => Boolean(deal.expiresAt) && new Date(deal.expiresAt).getTime() < Date.now();

const CategoryDealsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const category = route.params?.category ?? 'All';
  const deals = useDataStore((state) => state.deals);
  const brandsById = useDataStore((state) => state.brandsById);
  const [sort, setSort] = useState('discount');
  const [gridView, setGridView] = useViewMode(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredDeals = useMemo(() => {
    let list = deals;
    if (category && category !== 'All') {
      list = list.filter((d) => d.category === category);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((d) => {
        const brand = brandsById[d.brandId];
        return (
          d.title?.toLowerCase().includes(q) ||
          d.discountLabel?.toLowerCase().includes(q) ||
          brand?.name?.toLowerCase().includes(q)
        );
      });
    }
    const byExpiry = (d) => new Date(d.expiresAt || '9999-12-31').getTime();
    const compare = {
      discount: (a, b) => discountValue(b) - discountValue(a),
      newest: (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime(),
      ending: (a, b) => byExpiry(a) - byExpiry(b),
    }[sort];
    // Expired offers stay reachable but never outrank live ones.
    list = [...list].sort((a, b) => isExpired(a) - isExpired(b) || compare(a, b));
    return list;
  }, [deals, category, query, sort, brandsById]);

  const { visibleItems: visibleDeals, isLoadingMore, loadMore } = usePagination(filteredDeals);
  const liveCount = useMemo(() => filteredDeals.filter((d) => !isExpired(d)).length, [filteredDeals]);
  const bestDiscount = useMemo(() => Math.max(0, ...filteredDeals.filter((d) => !isExpired(d)).map(discountValue)), [filteredDeals]);

  const toggleSearch = () => {
    setSearchOpen((open) => {
      if (open) setQuery('');
      return !open;
    });
  };

  const headerTitle = category && category !== 'All' ? category : 'Deals';

  return (
    <Screen style={styles.container}>
      <TopAppBar
        showBack
        title={headerTitle}
        titleAlign="left"
        hideProfile
        hideBorder
        rightSlot={
          <Pressable
            hitSlop={12}
            onPress={toggleSearch}
            style={styles.headerIconBtn}
            accessibilityRole="button"
            accessibilityLabel={searchOpen ? 'Close search' : 'Search deals'}>
            <Icon name={searchOpen ? 'close-outline' : 'search-outline'} size={22} color={colors.text} />
          </Pressable>
        }
      />

      {searchOpen && (
        <View style={styles.searchWrap}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search deals..." autoFocus />
        </View>
      )}

      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          <Text style={styles.summaryStrong}>{liveCount}</Text> live {liveCount === 1 ? 'deal' : 'deals'}
          {bestDiscount > 0 ? (
            <>
              {'  ·  '}up to <Text style={styles.summaryAccent}>{Math.round(bestDiscount)}% off</Text>
            </>
          ) : null}
        </Text>
        <ViewSwitcher gridView={gridView} onChange={setGridView} />
      </View>

      <View style={styles.toolbar}>
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Sort deals">
          {SORTS.map((option) => {
            const selected = sort === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => setSort(option.key)}
                hitSlop={6}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ pressed }) => [styles.chip, selected && styles.chipActive, pressed && styles.chipPressed]}>
                <Icon name={option.icon} size={14} color={selected ? colors.primary : colors.mutedInk} />
                <Text style={[styles.chipLabel, selected && styles.chipLabelActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        key={gridView ? 'deals-grid' : 'deals-list'}
        data={visibleDeals}
        keyExtractor={(item) => item.id}
        numColumns={gridView ? 2 : 1}
        columnWrapperStyle={gridView ? styles.row : undefined}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.five }]}
        showsVerticalScrollIndicator={false}
        onEndReached={() => loadMore()}
        onEndReachedThreshold={0.35}
        ListEmptyComponent={
          <EmptyState
            icon="pricetags-outline"
            title="No deals yet"
            body={
              query.trim()
                ? `No offers match "${query}".`
                : `No offers tracked in ${category === 'All' ? 'any category' : category} right now.`
            }
          />
        }
        renderItem={({ item, index }) => {
          const tag = `category-${item.id}`;
          return (
            <AnimatedListItem index={index} style={gridView ? styles.gridItem : styles.listItem}>
              <CouponCard
                variant={gridView ? 'vertical' : 'horizontal'}
                deal={item}
                brand={brandsById[item.brandId]}
                onPress={() => navigation.navigate('DealDetailScreen', { id: item.id, transitionTag: tag })}
                style={isExpired(item) ? styles.expired : undefined}
              />
            </AnimatedListItem>
          );
        }}
        ListFooterComponent={
          isLoadingMore ? <PaginationLoader variant={gridView ? 'grid' : 'list'} /> : null
        }
      />

    </Screen>
  );
};

export default CategoryDealsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerIconBtn: {
      padding: 2,
    },
    searchWrap: {
      paddingHorizontal: GRID_PAD,
      paddingBottom: 8,
    },
    summary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingHorizontal: GRID_PAD,
    },
    summaryText: {
      flexShrink: 1,
      fontSize: 14,
      color: colors.textSecondary,
    },
    summaryStrong: {
      fontWeight: '800',
      color: colors.text,
    },
    summaryAccent: {
      fontWeight: '700',
      color: colors.primary,
    },
    toolbar: {
      paddingHorizontal: GRID_PAD,
      paddingTop: 12,
      paddingBottom: 14,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    chipPressed: {
      opacity: 0.7,
    },
    chipLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    chipLabelActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    list: {
      paddingHorizontal: GRID_PAD,
      paddingTop: 4,
      flexGrow: 1,
    },
    row: {
      gap: GRID_GAP,
    },
    listItem: {
      marginBottom: 16,
    },
    gridItem: {
      width: CARD_W,
      marginBottom: GRID_GAP + 4,
    },
    expired: {
      opacity: 0.5,
    },
  });
