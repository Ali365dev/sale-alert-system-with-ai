import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { SCREEN_WIDTH, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import { loadDeals } from '../../services/dealsService';
import { usePagination } from '../../hooks/usePagination';
import AnimatedListItem from '../../components/AnimatedListItem';
import BrandCard from '../../components/BrandCard';
import EmptyState from '../../components/EmptyState';
import FilterChip from '../../components/FilterChip';
import PaginationLoader from '../../components/PaginationLoader';
import PrimaryButton from '../../components/PrimaryButton';
import SearchBar from '../../components/SearchBar';
import Skeleton from '../../components/Skeleton';
import TopAppBar from '../../components/TopAppBar';

const GRID_PAD = 20;
const GRID_GAP = 12;
const COLS = 3;
const TILE = (SCREEN_WIDTH - GRID_PAD * 2 - GRID_GAP * (COLS - 1)) / COLS;

const BrandListScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const brands = useDataStore((state) => state.brands);
  const categories = useDataStore((state) => state.categories);
  const loading = useDataStore((state) => state.loading);
  const error = useDataStore((state) => state.error);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [searchOpen, setSearchOpen] = useState(false);

  const chips = useMemo(() => {
    const names = [];
    const seen = new Set();
    const add = (raw) => {
      const name = String(raw || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      names.push(name);
    };
    for (const category of categories) add(category.name);
    for (const brand of brands) add(brand.category);
    return ['All', ...names];
  }, [categories, brands]);

  const filtered = useMemo(() => {
    let list = [...brands];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((b) => b.name.toLowerCase().includes(q));
    }
    if (filter !== 'All') {
      const key = filter.toLowerCase();
      list = list.filter((b) => (b.category || '').toLowerCase() === key);
    }
    list.sort((a, b) => b.dealCount - a.dealCount || a.name.localeCompare(b.name));
    return list;
  }, [brands, query, filter]);

  const { visibleItems: visibleBrands, isLoadingMore, loadMore } = usePagination(filtered, 18);

  const toggleSearch = () => {
    setSearchOpen((open) => {
      if (open) setQuery('');
      return !open;
    });
  };

  const renderGrid = () => (
    <FlatList
      data={visibleBrands}
      keyExtractor={(b) => b.id}
      numColumns={COLS}
      key={`brand-grid-${COLS}`}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.four }]}
      showsVerticalScrollIndicator={false}
      onEndReached={() => loadMore()}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        <View style={styles.noResultsWrap}>
          <Icon name="search-outline" size={32} color={colors.textSecondary} />
          <Text style={styles.noResultsText}>
            {query.trim() ? `No brands match "${query}".` : `No brands in ${filter}.`}
          </Text>
          {query.trim() ? (
            <PrimaryButton
              label={`Request "${query.trim()}"`}
              icon="add-circle-outline"
              pill
              onPress={() => navigation.navigate('RequestBrandScreen', { brandName: query.trim() })}
            />
          ) : null}
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
      renderItem={({ item, index }) => (
        <AnimatedListItem index={index} style={styles.tile}>
          <BrandCard
            variant="tile"
            brand={item}
            onPress={() => navigation.navigate('BrandDetailScreen', { id: item.id })}
          />
        </AnimatedListItem>
      )}
    />
  );

  return (
    <View style={styles.container}>
      <TopAppBar
        showBack
        title="Brands"
        titleAlign="left"
        hideProfile
        hideBorder
        style={{ backgroundColor: colors.surface }}
        rightIcon={searchOpen ? 'close-outline' : 'search-outline'}
        onPressRight={toggleSearch}
      />

      {searchOpen && (
        <View style={styles.searchWrap}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search brands" autoFocus />
        </View>
      )}

      {chips.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipsScroll}>
          {chips.map((chip) => (
            <FilterChip key={chip} label={chip} tone="soft" selected={filter === chip} onPress={() => setFilter(chip)} />
          ))}
        </ScrollView>
      )}

      {loading && brands.length === 0 ? (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 12 }, (_, i) => (
            <View key={i} style={styles.tile}>
              <Skeleton width="100%" radius={18} style={styles.tileSkeleton} />
            </View>
          ))}
        </View>
      ) : error && !loading && brands.length === 0 ? (
        <EmptyState variant="error" icon="warning-outline" title="Couldn't load brands" body="Check your connection and try again." ctaLabel="Try again" onPressCta={loadDeals} />
      ) : !loading && brands.length === 0 ? (
        <EmptyState icon="business-outline" title="No brands tracked yet" body="Brands you track in your backend will show up here." ctaLabel="Refresh" onPressCta={loadDeals} />
      ) : (
        renderGrid()
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
    searchWrap: {
      paddingHorizontal: GRID_PAD,
      paddingBottom: SPACING.two,
      backgroundColor: colors.surface,
    },
    chipsScroll: {
      flexGrow: 0,
      flexShrink: 0,
      backgroundColor: colors.surface,
    },
    chips: {
      paddingHorizontal: GRID_PAD,
      paddingTop: SPACING.three,
      paddingBottom: SPACING.three,
      gap: SPACING.two,
    },
    list: {
      paddingHorizontal: GRID_PAD,
      paddingTop: SPACING.three,
    },
    row: {
      gap: GRID_GAP,
      marginBottom: GRID_GAP + 4,
    },
    tile: {
      width: TILE,
    },
    skeletonGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: GRID_PAD,
      gap: GRID_GAP,
    },
    tileSkeleton: {
      aspectRatio: 1,
      height: undefined,
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
