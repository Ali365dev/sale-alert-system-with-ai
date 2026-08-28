import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useDataStore from '../../state/dataStore';
import { loadDeals } from '../../services/dealsService';
import AnimatedListItem from '../../components/AnimatedListItem';
import CategoryCard from '../../components/CategoryCard';
import CategoryCardSkeleton from '../../components/CategoryCardSkeleton';
import EmptyState from '../../components/EmptyState';
import FilterChip from '../../components/FilterChip';
import SearchBar from '../../components/SearchBar';
import Skeleton from '../../components/Skeleton';
import TopAppBar from '../../components/TopAppBar';

const FILTERS = ['All Categories', 'Trending', 'Closing Soon'];

const CategoriesScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const categories = useDataStore((state) => state.categories);
  const deals = useDataStore((state) => state.deals);
  const loading = useDataStore((state) => state.loading);
  const error = useDataStore((state) => state.error);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All Categories');

  const bestDiscount = useMemo(
    () => deals.reduce((max, d) => Math.max(max, d.isPercentageOff ? parseInt(d.discountLabel) || 0 : 0), 0),
    [deals],
  );

  const visible = useMemo(() => {
    let list = categories;
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    if (filter === 'Trending') {
      list = [...list].sort((a, b) => b.dealCount - a.dealCount);
    }
    return list;
  }, [categories, query, filter]);

  if (loading && categories.length === 0) {
    return (
      <View style={styles.container}>
        <TopAppBar />
        <View style={styles.content}>
          <Skeleton width="100%" height={44} radius={999} />
          <View style={styles.skeletonRow}>
            <View style={styles.gridItem}>
              <CategoryCardSkeleton />
            </View>
            <View style={styles.gridItem}>
              <CategoryCardSkeleton />
            </View>
          </View>
          <View style={styles.skeletonRow}>
            <View style={styles.gridItem}>
              <CategoryCardSkeleton />
            </View>
            <View style={styles.gridItem}>
              <CategoryCardSkeleton />
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (error && !loading && categories.length === 0) {
    return (
      <View style={styles.container}>
        <TopAppBar />
        <EmptyState variant="error" icon="warning-outline" title="Couldn't load categories" body="Check your connection and try again." ctaLabel="Try again" onPressCta={loadDeals} />
      </View>
    );
  }

  if (!loading && categories.length === 0) {
    return (
      <View style={styles.container}>
        <TopAppBar />
        <EmptyState icon="grid-outline" title="No categories yet" body="Categories appear here once your backend has tracked offers with a category." ctaLabel="Refresh" onPressCta={loadDeals} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TopAppBar />
      <FlatList
        data={visible}
        keyExtractor={(c) => c.name}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.pageTitle}>Categories</Text>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search categories..." />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {FILTERS.map((f) => (
                <FilterChip key={f} label={f} selected={filter === f} onPress={() => setFilter(f)} />
              ))}
            </ScrollView>
          </View>
        }
        renderItem={({ item, index }) => (
          <AnimatedListItem index={index} style={styles.gridItem}>
            <CategoryCard category={item} onPress={() => navigation.navigate('CategoryDealsScreen', { category: item.name })} style={styles.gridItemFill} />
          </AnimatedListItem>
        )}
        ListFooterComponent={
          <Pressable style={styles.banner} onPress={() => navigation.navigate('Search')}>
            <Text style={styles.bannerTitle}>Flash Sale Frenzy</Text>
            <Text style={styles.bannerBody}>{bestDiscount > 0 ? `Up to ${bestDiscount}% off across all categories.` : 'Fresh deals land here as your backend tracks them.'}</Text>
            <View style={styles.bannerCta}>
              <Text style={styles.bannerCtaLabel}>Shop Now</Text>
            </View>
          </Pressable>
        }
      />
    </View>
  );
};

export default CategoriesScreen;

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
  row: {
    gap: SPACING.three,
  },
  skeletonRow: {
    flexDirection: 'row',
    gap: SPACING.three,
  },
  gridItem: {
    flexBasis: '47%',
  },
  gridItemFill: {
    flexBasis: '100%',
  },
  header: {
    gap: SPACING.three,
    marginBottom: SPACING.two,
  },
  pageTitle: {
    ...TYPOGRAPHY.title,
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.two,
  },
  banner: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.card,
    padding: SPACING.four,
    alignItems: 'center',
    marginTop: SPACING.three,
    gap: 4,
  },
  bannerTitle: {
    ...TYPOGRAPHY.headline,
    color: '#FFFFFF',
  },
  bannerBody: {
    ...TYPOGRAPHY.small,
    color: '#F5D9D9',
    textAlign: 'center',
  },
  bannerCta: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.four,
    paddingVertical: SPACING.two,
    marginTop: SPACING.two,
  },
  bannerCtaLabel: {
    ...TYPOGRAPHY.label,
    color: '#171717',
  },
});
