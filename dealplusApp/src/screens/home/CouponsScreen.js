import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SCREEN_WIDTH, SPACING } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import { loadDeals } from '../../services/dealsService';
import { channelTag } from '../../utils/dealAdapters';
import { isCloseToBottom } from '../../utils/scroll';
import { usePagination } from '../../hooks/usePagination';
import AnimatedListItem from '../../components/AnimatedListItem';
import BrandCard from '../../components/BrandCard';
import CouponCard from '../../components/CouponCard';
import { useCouponSheet } from '../../components/CouponSheet';
import EmptyState from '../../components/EmptyState';
import FilterChip from '../../components/FilterChip';
import PaginationLoader from '../../components/PaginationLoader';
import TopAppBar from '../../components/TopAppBar';
import ViewSwitcher from '../../components/ViewSwitcher';

const GRID_PAD = 20;
const GRID_GAP = 12;
const CARD_W = (SCREEN_WIDTH - GRID_PAD * 2 - GRID_GAP) / 2;

const FILTERS = [
  { id: 'all', label: 'All Coupons' },
  { id: 'in-store', label: 'In-Store' },
  { id: 'online', label: 'Online' },
  { id: 'expiring', label: 'Expiring Soon' },
];

const isExpiringSoon = (expiresAt) => {
  if (!expiresAt) return false;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return ms >= 0 && ms <= 7 * 24 * 60 * 60 * 1000;
};

const CouponsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [filter, setFilter] = useState('all');
  const [gridView, setGridView] = useState(false);
  const deals = useDataStore((state) => state.deals);
  const brands = useDataStore((state) => state.brands);
  const brandsById = useDataStore((state) => state.brandsById);
  const loading = useDataStore((state) => state.loading);

  const popularBrands = useMemo(
    () => [...brands].sort((a, b) => b.dealCount - a.dealCount || a.name.localeCompare(b.name)).slice(0, 12),
    [brands],
  );

  const filteredDeals = useMemo(() => {
    switch (filter) {
      case 'online':
        return deals.filter((d) => channelTag(d) === 'ONLINE');
      case 'in-store':
        return deals.filter((d) => channelTag(d) === 'IN-STORE');
      case 'expiring':
        return deals.filter((d) => isExpiringSoon(d.expiresAt));
      default:
        return deals;
    }
  }, [deals, filter]);

  const { visibleItems: visibleDeals, isLoadingMore, loadMore } = usePagination(filteredDeals);
  const { openCoupon, couponSheet } = useCouponSheet();

  const brandsHeader =
    popularBrands.length > 0 ? (
      <View style={styles.popular}>
        <View style={styles.popularHead}>
          <Text style={styles.popularTitle}>Popular Brands</Text>
          <Pressable onPress={() => navigation.navigate('BrandListScreen')} hitSlop={8}>
            <Text style={styles.seeAll}>See All →</Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.brandRow}>
          {popularBrands.map((brand) => (
            <BrandCard
              key={brand.id}
              brand={brand}
              variant="store"
              onPress={() => navigation.navigate('BrandDetailScreen', { id: brand.id })}
            />
          ))}
        </ScrollView>
      </View>
    ) : null;

  return (
    <View style={styles.container}>
      <TopAppBar
        title="Coupons"
        hideBorder
        rightIcon="search-outline"
        onPressRight={() => navigation.navigate('SearchScreen')}
      />

      <View style={styles.toolbar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          style={styles.filtersScroll}>
          {FILTERS.map((item) => (
            <FilterChip
              key={item.id}
              label={item.label}
              tone="soft"
              selected={filter === item.id}
              onPress={() => setFilter(item.id)}
            />
          ))}
        </ScrollView>
        <ViewSwitcher gridView={gridView} onChange={setGridView} />
      </View>

      {filteredDeals.length === 0 && popularBrands.length === 0 ? (
        <EmptyState
          icon="pricetag-outline"
          title={deals.length === 0 ? 'No coupons yet' : 'No matches'}
          body={deals.length === 0 ? 'New brand offers will show up here as coupons.' : 'Try another filter to see more coupons.'}
          ctaLabel={deals.length === 0 ? 'Refresh' : 'Show all'}
          onPressCta={deals.length === 0 ? loadDeals : () => setFilter('all')}
        />
      ) : (
        <FlatList
          key={gridView ? 'coupons-grid' : 'coupons-list'}
          data={visibleDeals}
          keyExtractor={(item) => item.id}
          numColumns={gridView ? 2 : 1}
          columnWrapperStyle={gridView ? styles.row : undefined}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 88 }]}
          showsVerticalScrollIndicator={false}
          onScroll={({ nativeEvent }) => isCloseToBottom(nativeEvent) && loadMore()}
          scrollEventThrottle={200}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDeals} tintColor={colors.primary} />}
          ListHeaderComponent={brandsHeader}
          ListEmptyComponent={
            <EmptyState
              icon="pricetag-outline"
              title={deals.length === 0 ? 'No coupons yet' : 'No matches'}
              body={deals.length === 0 ? 'New brand offers will show up here as coupons.' : 'Try another filter to see more coupons.'}
              ctaLabel={deals.length === 0 ? 'Refresh' : 'Show all'}
              onPressCta={deals.length === 0 ? loadDeals : () => setFilter('all')}
            />
          }
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index} style={gridView ? styles.gridItem : styles.listItem}>
              <CouponCard
                deal={item}
                brand={brandsById[item.brandId]}
                variant={gridView ? 'vertical' : 'horizontal'}
                onPress={() => openCoupon(item)}
              />
            </AnimatedListItem>
          )}
          ListFooterComponent={isLoadingMore ? <PaginationLoader /> : null}
        />
      )}
      {couponSheet}
    </View>
  );
};

export default CouponsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingLeft: GRID_PAD,
      paddingRight: 12,
      paddingVertical: SPACING.two,
      flexGrow: 0,
      flexShrink: 0,
    },
    filtersScroll: {
      flex: 1,
      flexGrow: 1,
      flexShrink: 1,
    },
    filters: {
      alignItems: 'center',
      paddingVertical: SPACING.two,
      paddingRight: SPACING.two,
      gap: SPACING.two,
    },
    popular: {
      marginBottom: SPACING.three,
      gap: 14,
    },
    popularHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    popularTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
    },
    seeAll: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.sale,
    },
    brandRow: {
      gap: 12,
      paddingRight: 4,
      paddingVertical: 2,
    },
    list: {
      paddingHorizontal: GRID_PAD,
    },
    row: {
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    gridItem: {
      width: CARD_W,
    },
    listItem: {
      width: '100%',
      marginBottom: 16,
    },
  });
