import { useMemo } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeOut } from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import { loadDeals } from '../../services/dealsService';
import { slugify } from '../../utils/dealAdapters';
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
  const followedBrands = usePreferencesStore((state) => state.followedBrands);
  const favoriteCategories = usePreferencesStore((state) => state.favoriteCategories);

  // Any-overlap match against the device's saved brands/categories, newest
  // first. Empty when the user has no saved preferences yet — the section
  // just doesn't render, "Latest Offers" below still shows everything.
  const forYouDeals = useMemo(() => {
    if (followedBrands.length === 0 && favoriteCategories.length === 0) return [];
    const brandSlugs = new Set(followedBrands.map(slugify));
    const categorySet = new Set(favoriteCategories);
    const matched = deals.filter((d) => brandSlugs.has(d.brandId) || categorySet.has(d.category));
    return [...matched].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [deals, followedBrands, favoriteCategories]);

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
      <TopAppBar />

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
            <View style={styles.rowList}>
              {[0, 1, 2, 3].map((i) => (
                <CategoryCardSkeleton key={i} />
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
          <View style={styles.searchRow}>
            <Pressable style={styles.searchBar} onPress={() => navigation.navigate('Search')}>
              <Icon name="search" size={18} color="#6B7280" />
              <Text style={styles.searchPlaceholder}>Search brands or deals...</Text>
            </Pressable>
            <Pressable style={styles.filterButton} onPress={() => navigation.navigate('Search')}>
              <Icon name="options-outline" size={20} color="#FFFFFF" />
            </Pressable>
          </View>

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
                ListFooterComponent={
                  <Pressable style={styles.moreBrands} onPress={() => navigation.navigate('BrandListScreen')}>
                    <View style={styles.moreBrandsCircle}>
                      <Icon name="add" size={22} color="#6B7280" />
                    </View>
                    <Text style={styles.moreBrandsLabel}>More{'\n'}Brands</Text>
                  </Pressable>
                }
              />
            </View>
          )}

          {heroDeals.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Hot Deals" onViewAll={() => navigation.navigate('Search')} />
              <HeroCarousel deals={heroDeals} brandsById={brandsById} onPressDeal={openDeal} />
            </View>
          )}

          {forYouDeals.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="For You" onViewAll={() => navigation.navigate('Search')} />
              <View style={styles.dealsList}>
                {forYouDeals.slice(0, 6).map((deal, index) => (
                  <AnimatedListItem key={deal.id} index={index}>
                    <DealCard deal={deal} brand={brandsById[deal.brandId]} onPress={() => openDeal(deal)} />
                  </AnimatedListItem>
                ))}
              </View>
            </View>
          )}

          {previewCategories.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title="Browse Categories" />
              <FlatList
                horizontal
                data={previewCategories}
                keyExtractor={(c) => c.name}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rowList}
                renderItem={({ item, index }) => (
                  <AnimatedListItem index={index}>
                    <CategoryCard category={item} variant="circle" onPress={() => navigation.navigate('Search', { category: item.name })} />
                  </AnimatedListItem>
                )}
              />
            </View>
          )}

          <Pressable style={styles.signupBanner}>
            <View style={styles.signupIcon}>
              <Icon name="pricetag" size={22} color="#FFFFFF" />
            </View>
            <View style={styles.signupText}>
              <Text style={styles.signupTitle}>Get Exclusive Deals & Offers!</Text>
              <Text style={styles.signupBody}>Sign up and never miss a deal again.</Text>
            </View>
            <View style={styles.signupButton}>
              <Text style={styles.signupButtonLabel}>Sign Up</Text>
              <Icon name="chevron-forward" size={14} color="#FFFFFF" />
            </View>
          </Pressable>

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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.two,
    paddingHorizontal: SPACING.four,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.two,
    backgroundColor: '#F8F9FB',
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.three,
    height: 48,
  },
  searchPlaceholder: {
    ...TYPOGRAPHY.default,
    color: '#6B7280',
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.chip,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
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
  moreBrands: {
    alignItems: 'center',
    width: 84,
    gap: SPACING.two,
  },
  moreBrandsCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBrandsLabel: {
    ...TYPOGRAPHY.smallBold,
    color: '#6B7280',
    textAlign: 'center',
  },
  signupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.three,
    marginHorizontal: SPACING.four,
    backgroundColor: '#FDEEEE',
    borderRadius: RADIUS.card,
    padding: SPACING.three,
  },
  signupIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signupText: {
    flex: 1,
    gap: 2,
  },
  signupTitle: {
    ...TYPOGRAPHY.smallBold,
    fontSize: 15,
  },
  signupBody: {
    ...TYPOGRAPHY.small,
    color: '#6B7280',
  },
  signupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.three,
    paddingVertical: SPACING.two,
  },
  signupButtonLabel: {
    ...TYPOGRAPHY.label,
    color: '#FFFFFF',
    fontSize: 13,
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
