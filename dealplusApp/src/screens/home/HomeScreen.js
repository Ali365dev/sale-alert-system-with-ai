import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeOut } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useDataStore from '../../state/dataStore';
import { loadDeals } from '../../services/dealsService';
import AnimatedListItem from '../../components/AnimatedListItem';
import BrandCard from '../../components/BrandCard';
import BrandCardSkeleton from '../../components/BrandCardSkeleton';
import CategoryCard from '../../components/CategoryCard';
import CategoryCardSkeleton from '../../components/CategoryCardSkeleton';
import DealCard from '../../components/DealCard';
import DealCardSkeleton from '../../components/DealCardSkeleton';
import EmptyState from '../../components/EmptyState';
import ExpiringSoonCard from '../../components/ExpiringSoonCard';
import HeroCarousel from '../../components/HeroCarousel';
import SectionHeader from '../../components/SectionHeader';
import Skeleton from '../../components/Skeleton';
import TopAppBar from '../../components/TopAppBar';

const HomeScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const deals = useDataStore((state) => state.deals);
  const categories = useDataStore((state) => state.categories);
  const brandsById = useDataStore((state) => state.brandsById);
  const brands = useDataStore((state) => state.brands);
  const loading = useDataStore((state) => state.loading);
  const error = useDataStore((state) => state.error);

  const heroDeals = useMemo(() => {
    const withExpiry = deals.filter((d) => !!d.expiresAt);
    const sorted = [...withExpiry].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    return sorted.slice(0, 4);
  }, [deals]);
  const trendingBrands = useMemo(() => [...brands].sort((a, b) => b.dealCount - a.dealCount).slice(0, 8), [brands]);
  const previewCategories = useMemo(() => categories.slice(0, 4), [categories]);
  const expiringSoon = useMemo(() => {
    const withExpiry = deals.filter((d) => !!d.expiresAt);
    const sorted = [...withExpiry].sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
    return sorted.slice(0, 4);
  }, [deals]);

  const openDeal = (deal) => navigation.navigate('DealDetailScreen', { id: deal.id });
  const openBrand = (brandId) => navigation.navigate('BrandDetailScreen', { id: brandId });

  return (
    <View style={styles.container}>
      <TopAppBar hideProfile />

      {loading && deals.length === 0 ? (
        <Animated.View exiting={FadeOut.duration(200)} style={styles.content}>
          <View style={styles.skeletonPad}>
            <Skeleton width="100%" height={48} radius={RADIUS.chip} />
          </View>

          <View style={styles.section}>
            <Skeleton width={140} height={20} style={styles.sectionTitleSkeleton} />
            <View style={styles.rowList}>
              {[0, 1, 2, 3].map((i) => (
                <BrandCardSkeleton key={i} />
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Skeleton width={110} height={20} style={styles.sectionTitleSkeleton} />
            <View style={styles.skeletonPad}>
              <Skeleton width="100%" height={210} radius={RADIUS.card} />
            </View>
          </View>

          <View style={styles.section}>
            <Skeleton width={160} height={20} style={styles.sectionTitleSkeleton} />
            <View style={styles.categoryGrid}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.categoryItem}>
                  <CategoryCardSkeleton />
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Skeleton width={130} height={20} style={styles.sectionTitleSkeleton} />
            <View style={styles.dealsList}>
              {[0, 1].map((i) => (
                <DealCardSkeleton key={i} />
              ))}
            </View>
          </View>
        </Animated.View>
      ) : error && deals.length === 0 ? (
        <EmptyState
          variant="error"
          icon="warning-outline"
          title="Couldn't load deals"
          body="Check your connection and try again."
          ctaLabel="Try again"
          onPressCta={loadDeals}
        />
      ) : deals.length === 0 ? (
        <EmptyState
          icon="pricetags-outline"
          title="No offers tracked yet"
          body="Once your backend pipeline picks up brand emails, deals will show up here automatically."
          ctaLabel="Refresh"
          onPressCta={loadDeals}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadDeals} tintColor="#B7131A" />}>
          <Pressable style={styles.searchBar} onPress={() => navigation.navigate('Search')}>
            <Icon name="search" size={18} color="#6B7280" />
            <Text style={styles.searchPlaceholder}>Search brands or deals...</Text>
          </Pressable>

          {trendingBrands.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Trending Brands" onViewAll={() => navigation.navigate('BrandListScreen')} />
              <FlatList
                horizontal
                data={trendingBrands}
                keyExtractor={(b) => b.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowList}
                renderItem={({ item, index }) => (
                  <AnimatedListItem index={index}>
                    <BrandCard brand={item} onPress={() => openBrand(item.id)} />
                  </AnimatedListItem>
                )}
              />
            </View>
          )}

          {heroDeals.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Hot Deals" onViewAll={() => navigation.navigate('Search')} />
              <HeroCarousel deals={heroDeals} brandsById={brandsById} onPressDeal={openDeal} />
            </View>
          )}

          {previewCategories.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Browse Categories" />
              <View style={styles.categoryGrid}>
                {previewCategories.map((c, index) => (
                  <AnimatedListItem key={c.name} index={index} style={styles.categoryItem}>
                    <CategoryCard
                      category={c}
                      variant="compact"
                      onPress={() => navigation.navigate('Search', { category: c.name })}
                      style={styles.categoryItemFill}
                    />
                  </AnimatedListItem>
                ))}
              </View>
            </View>
          )}

          {expiringSoon.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Expiring Soon" />
              <View style={styles.dealsList}>
                {expiringSoon.map((deal, index) => (
                  <AnimatedListItem key={deal.id} index={index}>
                    <ExpiringSoonCard deal={deal} onPress={() => openDeal(deal)} />
                  </AnimatedListItem>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.latestHeader}>
              <Text style={styles.latestTitle}>Latest Offers</Text>
              <Pressable style={styles.filterLink} onPress={() => navigation.navigate('Search')}>
                <Icon name="filter-outline" size={16} color="#6B7280" />
                <Text style={styles.filterLabel}>Filter</Text>
              </Pressable>
            </View>
            <View style={styles.dealsList}>
              {deals.map((deal, index) => (
                <AnimatedListItem key={deal.id} index={index}>
                  <DealCard deal={deal} brand={brandsById[deal.brandId]} onPress={() => openDeal(deal)} />
                </AnimatedListItem>
              ))}
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    gap: SPACING.five,
    paddingTop: SPACING.three,
  },
  section: {
    gap: SPACING.three,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.two,
    backgroundColor: '#F8F9FB',
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.three,
    marginHorizontal: SPACING.four,
    height: 48,
  },
  searchPlaceholder: {
    ...TYPOGRAPHY.default,
    color: '#6B7280',
  },
  skeletonPad: {
    paddingHorizontal: SPACING.four,
  },
  sectionTitleSkeleton: {
    marginHorizontal: SPACING.four,
  },
  rowList: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.four,
    gap: SPACING.three,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.three,
    paddingHorizontal: SPACING.four,
  },
  categoryItem: {
    flexBasis: '47%',
  },
  categoryItemFill: {
    flexBasis: '100%',
  },
  latestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.four,
  },
  latestTitle: {
    ...TYPOGRAPHY.headline,
  },
  filterLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  filterLabel: {
    ...TYPOGRAPHY.small,
    color: '#6B7280',
  },
  dealsList: {
    paddingHorizontal: SPACING.four,
    gap: SPACING.three,
  },
});
