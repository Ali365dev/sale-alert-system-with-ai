import { useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '../../components/Screen';
import { SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import { orderDealsByPreference } from '../../utils/dealAdapters';
import { isCloseToBottom } from '../../utils/scroll';
import { usePagination } from '../../hooks/usePagination';
import AnimatedListItem from '../../components/AnimatedListItem';
import DealCard from '../../components/DealCard';
import EmptyState from '../../components/EmptyState';
import PaginationLoader from '../../components/PaginationLoader';
import TopAppBar from '../../components/TopAppBar';

const ForYouScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const deals = useDataStore((state) => state.deals);
  const brandsById = useDataStore((state) => state.brandsById);
  const followedBrands = usePreferencesStore((state) => state.followedBrands);
  const favoriteCategories = usePreferencesStore((state) => state.favoriteCategories);

  const forYouDeals = useMemo(
    () => orderDealsByPreference(deals, followedBrands, favoriteCategories),
    [deals, followedBrands, favoriteCategories],
  );
  const { visibleItems: visibleDeals, hasMore, isLoadingMore, loadMore } = usePagination(forYouDeals);
  const viewportH = useRef(0);

  return (
    <Screen style={styles.container}>
      <TopAppBar showBack />

      {forYouDeals.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="No deals yet"
          body="Deals that match your brands and preferences show up first. Latest deals fill in when a preference has no offers."
          ctaLabel={favoriteCategories.length === 0 ? 'Set deal preference' : 'Follow brands'}
          onPressCta={() =>
            navigation.navigate(favoriteCategories.length === 0 ? 'DealPreferenceScreen' : 'FollowedBrandsScreen')
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.four }]}
          showsVerticalScrollIndicator={false}
          onLayout={(e) => {
            viewportH.current = e.nativeEvent.layout.height;
          }}
          onScroll={({ nativeEvent }) => isCloseToBottom(nativeEvent) && loadMore()}
          onContentSizeChange={(_w, h) => {
            // First page may not fill the screen — load more until it scrolls or we run out.
            if (viewportH.current > 0 && h <= viewportH.current + 160 && hasMore) loadMore();
          }}
          scrollEventThrottle={160}>
          <Text style={styles.pageTitle}>For You</Text>
          <Text style={styles.subtitle}>Matched from your followed brands and categories.</Text>
          <View style={styles.list}>
            {visibleDeals.map((deal, index) => {
              const tag = `foryou-${deal.id}`;
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
            {isLoadingMore ? <PaginationLoader /> : null}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
};

export default ForYouScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.three,
    },
    pageTitle: {
      ...TYPOGRAPHY.title,
      color: colors.text,
    },
    subtitle: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      marginTop: SPACING.one,
      marginBottom: SPACING.four,
    },
    list: {
      gap: SPACING.three,
    },
  });
