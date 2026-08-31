import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import { loadDeals } from '../../services/dealsService';
import { usePagination } from '../../hooks/usePagination';
import AnimatedListItem from '../../components/AnimatedListItem';
import EmptyState from '../../components/EmptyState';
import FilterChip from '../../components/FilterChip';
import PaginationLoader from '../../components/PaginationLoader';
import SearchBar from '../../components/SearchBar';
import Skeleton from '../../components/Skeleton';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';

const FILTERS = ['All', 'Trending', 'Newly Added', 'Expiring Soon'];

const BrandListScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const brands = useDataStore((state) => state.brands);
  const deals = useDataStore((state) => state.deals);
  const loading = useDataStore((state) => state.loading);
  const error = useDataStore((state) => state.error);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');

  const bestDiscountByBrand = useMemo(() => {
    const map = new Map();
    for (const d of deals) {
      if (!d.isPercentageOff) continue;
      const pct = Math.abs(parseInt(d.discountLabel) || 0);
      map.set(d.brandId, Math.max(map.get(d.brandId) ?? 0, pct));
    }
    return map;
  }, [deals]);

  const isNewBrand = (brand) => {
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
  const { visibleItems: visibleBrands, isLoadingMore, loadMore } = usePagination(filtered, 12);

  return (
    <View style={styles.container}>
      <TopAppBar showBack hideSearch />

      {loading && brands.length === 0 ? (
        <View style={styles.content}>
          <View style={styles.header}>
            <Skeleton width={140} height={26} />
            <Skeleton width="100%" height={44} radius={999} />
          </View>
          <View style={styles.skeletonRow}>
            {[0, 1].map((i) => (
              <View key={i} style={styles.tileSkeleton}>
                <Skeleton width="100%" radius={RADIUS.card} style={styles.tileSkeletonImage} />
                <Skeleton width="80%" height={14} style={styles.gapTop} />
                <Skeleton width="50%" height={12} style={styles.gapSmall} />
              </View>
            ))}
          </View>
        </View>
      ) : error && !loading && brands.length === 0 ? (
        <EmptyState variant="error" icon="warning-outline" title="Couldn't load brands" body="Check your connection and try again." ctaLabel="Try again" onPressCta={loadDeals} />
      ) : !loading && brands.length === 0 ? (
        <EmptyState icon="business-outline" title="No brands tracked yet" body="Brands you track in your backend will show up here." ctaLabel="Refresh" onPressCta={loadDeals} />
      ) : (
        <FlatList
          data={visibleBrands}
          keyExtractor={(b) => b.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.four }]}
          onEndReached={() => loadMore()}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.pageTitle}>Top Brands</Text>
              <SearchBar value={query} onChangeText={setQuery} placeholder="Search brands" />
              <View style={styles.filterRow}>
                {FILTERS.map((f) => (
                  <FilterChip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
                ))}
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.noResultsWrap}>
              <Icon name="search-outline" size={32} color={colors.textSecondary} />
              <Text style={styles.noResultsText}>No brands match "{query}".</Text>
              <PrimaryButton
                label={`Request "${query.trim()}"`}
                icon="add-circle-outline"
                pill
                onPress={() => navigation.navigate('RequestBrandScreen', { brandName: query.trim() })}
              />
            </View>
          }
          ListFooterComponent={
            filtered.length > 0 && (
              <>
                {isLoadingMore && <PaginationLoader />}
                <Pressable style={styles.requestLink} onPress={() => navigation.navigate('RequestBrandScreen')}>
                  <Icon name="add-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.requestLinkLabel}>Can't find a brand? Request it</Text>
                </Pressable>
              </>
            )
          }
          renderItem={({ item, index }) => {
            const discount = bestDiscountByBrand.get(item.id);
            return (
              <AnimatedListItem index={index} style={styles.card}>
                <Pressable style={styles.cardInner} onPress={() => navigation.navigate('BrandDetailScreen', { id: item.id })}>
                  <View style={styles.imageWrap}>
                    <FastImage source={{ uri: item.coverImage }} style={styles.image} resizeMode={FastImage.resizeMode.cover} />
                    {isNewBrand(item) && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeLabel}>NEWEST DEALS</Text>
                      </View>
                    )}
                    <View style={styles.heartButton}>
                      <Icon name="heart-outline" size={16} color="#171717" />
                    </View>
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.brandName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.brandCategory} numberOfLines={1}>
                      {item.category}
                    </Text>
                    {discount ? (
                      <Text style={styles.discountLabel}>UP TO {discount}% OFF</Text>
                    ) : (
                      <Text style={styles.dealCount}>{item.dealCount} deals</Text>
                    )}
                  </View>
                </Pressable>
              </AnimatedListItem>
            );
          }}
        />
      )}
    </View>
  );
};

export default BrandListScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      gap: SPACING.three,
      marginBottom: SPACING.three,
    },
    pageTitle: {
      ...TYPOGRAPHY.title,
      color: colors.text,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: SPACING.two,
    },
    content: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.three,
    },
    row: {
      justifyContent: 'space-between',
      gap: SPACING.three,
    },
    skeletonRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: SPACING.three,
    },
    tileSkeleton: {
      width: '48%',
    },
    tileSkeletonImage: {
      aspectRatio: 1,
      height: undefined,
    },
    gapTop: {
      marginTop: SPACING.two,
    },
    gapSmall: {
      marginTop: 4,
    },
    card: {
      width: '48%',
      marginBottom: SPACING.three,
    },
    cardInner: {
      borderRadius: RADIUS.card,
      overflow: 'hidden',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
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
      top: SPACING.two,
      left: SPACING.two,
      backgroundColor: '#F5CB1B',
      paddingHorizontal: SPACING.two,
      paddingVertical: 3,
      borderRadius: 4,
    },
    newBadgeLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: '#171717',
    },
    heartButton: {
      position: 'absolute',
      top: SPACING.two,
      right: SPACING.two,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.9)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBody: {
      padding: SPACING.three,
      gap: 2,
    },
    brandName: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
    },
    brandCategory: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    dealCount: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    discountLabel: {
      ...TYPOGRAPHY.smallBold,
      color: colors.primary,
    },
    noResultsWrap: {
      alignItems: 'center',
      gap: SPACING.three,
      paddingHorizontal: SPACING.five,
      paddingTop: SPACING.six,
    },
    noResultsText: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    requestLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.two,
      paddingVertical: SPACING.four,
    },
    requestLinkLabel: {
      ...TYPOGRAPHY.smallBold,
      color: colors.primary,
    },
  });
