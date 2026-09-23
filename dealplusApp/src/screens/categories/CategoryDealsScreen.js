import { useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { SCREEN_WIDTH, SPACING } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import { channelTag } from '../../utils/dealAdapters';
import { isCloseToBottom } from '../../utils/scroll';
import { usePagination } from '../../hooks/usePagination';
import AnimatedListItem from '../../components/AnimatedListItem';
import DealCard from '../../components/DealCard';
import DealFilterSheet from '../../components/DealFilterSheet';
import EmptyState from '../../components/EmptyState';
import PaginationLoader from '../../components/PaginationLoader';
import SearchBar from '../../components/SearchBar';
import TopAppBar from '../../components/TopAppBar';
import ViewSwitcher from '../../components/ViewSwitcher';
import useViewMode from '../../hooks/useViewMode';

const GRID_PAD = 20;
const GRID_GAP = 12;
const CARD_W = (SCREEN_WIDTH - GRID_PAD * 2 - GRID_GAP) / 2;

const SORTS = ['Highest Discount', 'Newest', 'Expiring Soonest'];

const CategoryDealsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const filterSheetRef = useRef(null);
  const category = route.params?.category ?? 'All';
  const deals = useDataStore((state) => state.deals);
  const brandsById = useDataStore((state) => state.brandsById);
  const [sort, setSort] = useState('Highest Discount');
  const [channel, setChannel] = useState('all');
  const [sortOpen, setSortOpen] = useState(false);
  const [gridView, setGridView] = useViewMode(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filteredDeals = useMemo(() => {
    let list = deals;
    if (category && category !== 'All') {
      list = list.filter((d) => d.category === category);
    }
    if (channel !== 'all') {
      list = list.filter((d) => channelTag(d) === channel);
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
    if (sort === 'Highest Discount') {
      list = [...list].sort((a, b) => (parseInt(a.discountLabel) || 0) - (parseInt(b.discountLabel) || 0));
    } else if (sort === 'Newest') {
      list = [...list].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    } else {
      list = [...list].sort((a, b) => new Date(a.expiresAt || '9999').getTime() - new Date(b.expiresAt || '9999').getTime());
    }
    return list;
  }, [deals, category, channel, query, sort, brandsById]);

  const { visibleItems: visibleDeals, isLoadingMore, loadMore } = usePagination(filteredDeals);
  const filterActive = channel !== 'all';

  const toggleSearch = () => {
    setSearchOpen((open) => {
      if (open) setQuery('');
      return !open;
    });
  };

  const headerTitle = category && category !== 'All' ? category : 'Deals';

  return (
    <View style={styles.container}>
      <TopAppBar
        showBack
        title={headerTitle}
        titleAlign="left"
        hideProfile
        hideBorder
        rightSlot={
          <View style={styles.headerActions}>
            <Pressable
              hitSlop={12}
              onPress={() => {
                setSortOpen(false);
                filterSheetRef.current?.present();
              }}
              accessibilityRole="button"
              accessibilityLabel="Filter deals"
              style={styles.headerIconBtn}>
              <Icon name="options-outline" size={22} color={filterActive ? colors.primary : colors.text} />
              {filterActive ? <View style={styles.filterDot} /> : null}
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={toggleSearch}
              accessibilityRole="button"
              accessibilityLabel={searchOpen ? 'Close search' : 'Search deals'}>
              <Icon name={searchOpen ? 'close-outline' : 'search-outline'} size={22} color={colors.text} />
            </Pressable>
          </View>
        }
      />

      {searchOpen && (
        <View style={styles.searchWrap}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search deals..." autoFocus />
        </View>
      )}

      <View style={styles.toolbar}>
        <View style={styles.menuWrap}>
          <Pressable style={styles.menuBtn} onPress={() => setSortOpen((open) => !open)}>
            <Icon name="swap-vertical-outline" size={14} color={colors.text} />
            <Text style={styles.menuLabel}>Sort</Text>
            <Icon name={sortOpen ? 'chevron-up' : 'chevron-down'} size={12} color={colors.text} />
          </Pressable>
          {sortOpen && (
            <View style={styles.dropdown}>
              {SORTS.map((option, index) => (
                <Pressable
                  key={option}
                  style={[styles.dropdownItem, index === SORTS.length - 1 && styles.dropdownItemLast]}
                  onPress={() => {
                    setSort(option);
                    setSortOpen(false);
                  }}>
                  <Text style={styles.dropdownLabel}>{option}</Text>
                  {sort === option && <Icon name="checkmark" size={16} color={colors.primary} />}
                </Pressable>
              ))}
            </View>
          )}
        </View>
        <ViewSwitcher gridView={gridView} onChange={setGridView} />
      </View>

      <FlatList
        key={gridView ? 'deals-grid' : 'deals-list'}
        data={visibleDeals}
        keyExtractor={(item) => item.id}
        numColumns={gridView ? 2 : 1}
        columnWrapperStyle={gridView ? styles.row : undefined}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.five }]}
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => isCloseToBottom(nativeEvent) && loadMore()}
        scrollEventThrottle={200}
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
              <DealCard
                variant={gridView ? 'offerGrid' : 'offer'}
                deal={item}
                brand={brandsById[item.brandId]}
                transitionTag={tag}
                onPress={() => navigation.navigate('DealDetailScreen', { id: item.id, transitionTag: tag })}
              />
            </AnimatedListItem>
          );
        }}
        ListFooterComponent={isLoadingMore ? <PaginationLoader /> : null}
      />

      <DealFilterSheet ref={filterSheetRef} channel={channel} onSelect={setChannel} />
    </View>
  );
};

export default CategoryDealsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    headerIconBtn: {
      position: 'relative',
      padding: 2,
    },
    filterDot: {
      position: 'absolute',
      top: 0,
      right: 0,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.primary,
      borderWidth: 1.5,
      borderColor: colors.background,
    },
    searchWrap: {
      paddingHorizontal: GRID_PAD,
      paddingBottom: 8,
    },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: GRID_PAD,
      paddingTop: 8,
      paddingBottom: 12,
      zIndex: 20,
    },
    menuWrap: {
      zIndex: 21,
    },
    menuBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E8ECF1',
      borderRadius: 999,
      paddingHorizontal: 13,
      paddingVertical: 7,
    },
    menuLabel: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.text,
    },
    dropdown: {
      position: 'absolute',
      top: '100%',
      left: 0,
      marginTop: 6,
      minWidth: 180,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      overflow: 'hidden',
      zIndex: 30,
      elevation: 6,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    dropdownItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.three,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dropdownItemLast: {
      borderBottomWidth: 0,
    },
    dropdownLabel: {
      fontSize: 13,
      fontWeight: '500',
      color: colors.text,
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
      marginBottom: 12,
    },
    gridItem: {
      width: CARD_W,
      marginBottom: GRID_GAP,
    },
  });
