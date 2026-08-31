import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import { isCloseToBottom } from '../../utils/scroll';
import { usePagination } from '../../hooks/usePagination';
import AnimatedListItem from '../../components/AnimatedListItem';
import PaginationLoader from '../../components/PaginationLoader';
import DealCard from '../../components/DealCard';
import EmptyState from '../../components/EmptyState';

const SORTS = ['Highest Discount', 'Newest', 'Expiring Soonest'];

const CategoryDealsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const category = route.params?.category;
  const deals = useDataStore((state) => state.deals);
  const brandsById = useDataStore((state) => state.brandsById);
  const [sort, setSort] = useState('Highest Discount');
  const [sortOpen, setSortOpen] = useState(false);

  const categoryDeals = useMemo(() => {
    let list = deals.filter((d) => d.category === category);
    if (sort === 'Highest Discount') {
      // discountLabel is a negative string like "-70%" (or non-numeric for
      // non-percentage offers, which parseInt gives 0) — ascending by that
      // raw value puts the biggest discount (most negative) first.
      list = [...list].sort((a, b) => (parseInt(a.discountLabel) || 0) - (parseInt(b.discountLabel) || 0));
    } else if (sort === 'Newest') {
      list = [...list].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    } else {
      list = [...list].sort((a, b) => new Date(a.expiresAt || '9999').getTime() - new Date(b.expiresAt || '9999').getTime());
    }
    return list;
  }, [deals, category, sort]);
  const { visibleItems: visibleDeals, isLoadingMore, loadMore } = usePagination(categoryDeals);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + SPACING.three }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <Icon name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {category}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {categoryDeals.length === 0 ? (
        <EmptyState icon="pricetags-outline" title="No deals yet" body={`No offers tracked in ${category ?? 'this category'} right now.`} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.five }]}
          showsVerticalScrollIndicator={false}
          onScroll={({ nativeEvent }) => isCloseToBottom(nativeEvent) && loadMore()}
          scrollEventThrottle={200}>
          <View style={styles.metaRow}>
            <Text style={styles.count}>
              {categoryDeals.length} deal{categoryDeals.length === 1 ? '' : 's'}
            </Text>
            <View style={styles.sortWrap}>
              <Pressable style={styles.sortBox} onPress={() => setSortOpen((o) => !o)}>
                <Text style={styles.sortLabel}>{sort}</Text>
                <Icon name={sortOpen ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
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
          </View>

          <View style={styles.list}>
            {visibleDeals.map((deal, index) => {
              const tag = `category-${deal.id}`;
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
        </ScrollView>
      )}
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.four,
      paddingBottom: SPACING.three,
      gap: SPACING.two,
    },
    headerTitle: {
      ...TYPOGRAPHY.subtitle,
      color: colors.text,
      flex: 1,
      textAlign: 'center',
    },
    headerSpacer: {
      width: 24,
    },
    content: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.two,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.three,
    },
    count: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
    },
    sortWrap: {
      zIndex: 10,
    },
    sortBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.button,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two,
    },
    sortLabel: {
      ...TYPOGRAPHY.small,
      color: colors.text,
    },
    sortDropdown: {
      position: 'absolute',
      top: '100%',
      right: 0,
      marginTop: SPACING.one,
      minWidth: 180,
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
    list: {
      gap: SPACING.three,
    },
  });
