import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SCREEN_WIDTH, SHADOWS, SPACING } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import useFavoritesStore from '../../state/favoritesStore';
import usePreferencesStore from '../../state/preferencesStore';
import { isCloseToBottom } from '../../utils/scroll';
import { usePagination } from '../../hooks/usePagination';
import AnimatedListItem from '../../components/AnimatedListItem';
import BrandCard from '../../components/BrandCard';
import CouponCard from '../../components/CouponCard';
import { useCouponSheet } from '../../components/CouponSheet';
import PaginationLoader from '../../components/PaginationLoader';
import ViewSwitcher from '../../components/ViewSwitcher';
import useViewMode from '../../hooks/useViewMode';

const PAD = 20;
const GRID_GAP = 12;
const CARD_W = (SCREEN_WIDTH - PAD * 2 - GRID_GAP) / 2;
const TABS = [
  { id: 'coupons', label: 'coupons' },
  { id: 'stores', label: 'stores' },
];

const FollowedBrandsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [tab, setTab] = useState('coupons');
  const [gridView, setGridView] = useViewMode(false);

  const brands = useDataStore((state) => state.brands);
  const brandsById = useDataStore((state) => state.brandsById);
  const deals = useDataStore((state) => state.deals);
  const favoriteIds = useFavoritesStore((state) => state.favoriteIds);
  const followedBrands = usePreferencesStore((state) => state.followedBrands);
  const { openCoupon, couponSheet } = useCouponSheet();

  const favoriteDeals = useMemo(() => deals.filter((d) => favoriteIds.includes(d.id)), [deals, favoriteIds]);
  const followedBrandList = useMemo(
    () => brands.filter((b) => followedBrands.includes(b.name)),
    [brands, followedBrands],
  );

  const { visibleItems: visibleDeals, isLoadingMore, loadMore } = usePagination(favoriteDeals);

  const isCoupons = tab === 'coupons';
  const isEmpty = isCoupons ? favoriteDeals.length === 0 : followedBrandList.length === 0;

  const browse = () => {
    navigation.navigate('BrandListScreen');
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + SPACING.two }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Go back">
          <Icon name="chevron-back" size={24} color={colors.text} />
        </Pressable>
      </View>

      <Text style={styles.title}>Favorites</Text>

      <View style={styles.segmentRow}>
        <View style={styles.segment}>
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => setTab(item.id)}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}>
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.switcherRow}>
        <ViewSwitcher gridView={gridView} onChange={setGridView} />
      </View>

      {isEmpty ? (
        <Animated.View entering={FadeInDown.duration(420).springify().damping(16)} style={styles.emptyWrap}>
          <Icon name="heart" size={72} color={colors.mutedInk} />
          <Text style={styles.emptyTitle}>You haven't added any favourites yet</Text>
          <Text style={styles.emptyBody}>Follow stores and add more coupons to track your favourites</Text>
        </Animated.View>
      ) : isCoupons ? (
        <FlatList
          key={gridView ? 'fav-coupons-grid' : 'fav-coupons-list'}
          data={visibleDeals}
          keyExtractor={(d) => d.id}
          numColumns={gridView ? 2 : 1}
          columnWrapperStyle={gridView ? styles.gridRow : undefined}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          onScroll={({ nativeEvent }) => isCloseToBottom(nativeEvent) && loadMore()}
          scrollEventThrottle={200}
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
      ) : (
        <FlatList
          key={gridView ? 'fav-stores-grid' : 'fav-stores-list'}
          data={followedBrandList}
          keyExtractor={(b) => b.id}
          numColumns={gridView ? 3 : 2}
          columnWrapperStyle={styles.brandRow}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <AnimatedListItem index={index} style={gridView ? styles.brandTile3 : styles.brandTile2}>
              <BrandCard
                variant="tile"
                brand={item}
                onPress={() => navigation.navigate('BrandDetailScreen', { id: item.id })}
              />
            </AnimatedListItem>
          )}
        />
      )}

      {isEmpty ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            onPress={browse}
            style={styles.browseBtn}
            accessibilityRole="button"
            accessibilityLabel="Browse Stores">
            <Text style={styles.browseLabel}>Browse Stores</Text>
          </Pressable>
        </View>
      ) : null}

      {couponSheet}
    </View>
  );
};

export default FollowedBrandsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topBar: {
      paddingHorizontal: PAD,
      paddingBottom: SPACING.one,
    },
    title: {
      paddingHorizontal: PAD,
      fontSize: 34,
      lineHeight: 40,
      fontWeight: '800',
      letterSpacing: -0.6,
      color: colors.text,
      marginBottom: SPACING.four,
    },
    segmentRow: {
      paddingHorizontal: PAD,
      marginBottom: SPACING.three,
    },
    segment: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
    },
    segmentBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      borderRadius: 11,
    },
    segmentBtnActive: {
      backgroundColor: colors.primarySoft,
    },
    segmentLabel: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'lowercase',
    },
    segmentLabelActive: {
      color: colors.primary,
    },
    switcherRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: PAD,
      marginBottom: SPACING.two,
    },
    list: {
      paddingHorizontal: PAD,
      paddingTop: SPACING.two,
    },
    listItem: {
      marginBottom: 16,
      overflow: 'visible',
    },
    gridRow: {
      gap: GRID_GAP,
    },
    gridItem: {
      width: CARD_W,
      marginBottom: GRID_GAP,
      overflow: 'visible',
    },
    brandRow: {
      gap: GRID_GAP,
      marginBottom: GRID_GAP,
    },
    brandTile2: {
      width: (SCREEN_WIDTH - PAD * 2 - GRID_GAP) / 2,
    },
    brandTile3: {
      width: (SCREEN_WIDTH - PAD * 2 - GRID_GAP * 2) / 3,
    },
    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      paddingBottom: 120,
      gap: 14,
    },
    emptyTitle: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    emptyBody: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500',
      color: colors.textSecondary,
      textAlign: 'center',
    },
    footer: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 24,
      paddingTop: 12,
      backgroundColor: colors.background,
    },
    browseBtn: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.chip,
      minHeight: 56,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.button,
    },
    browseLabel: {
      color: '#FFFFFF',
      fontSize: 17,
      fontWeight: '800',
    },
  });
