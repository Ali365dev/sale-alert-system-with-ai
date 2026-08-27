import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import { filterForYou } from '../../utils/dealAdapters';
import AnimatedListItem from '../../components/AnimatedListItem';
import DealCard from '../../components/DealCard';
import EmptyState from '../../components/EmptyState';
import TopAppBar from '../../components/TopAppBar';

const ForYouScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const deals = useDataStore((state) => state.deals);
  const brandsById = useDataStore((state) => state.brandsById);
  const followedBrands = usePreferencesStore((state) => state.followedBrands);
  const favoriteCategories = usePreferencesStore((state) => state.favoriteCategories);

  const forYouDeals = useMemo(
    () => filterForYou(deals, followedBrands, favoriteCategories),
    [deals, followedBrands, favoriteCategories],
  );

  return (
    <View style={styles.container}>
      <TopAppBar showBack hideSearch />

      {forYouDeals.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="Nothing here yet"
          body="Follow some brands or categories and matching deals will show up here."
          ctaLabel="Follow brands"
          onPressCta={() => navigation.navigate('FollowedBrandsScreen')}
        />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.four }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.pageTitle}>For You</Text>
          <Text style={styles.subtitle}>Matched from your followed brands and categories.</Text>
          <View style={styles.list}>
            {forYouDeals.map((deal, index) => (
              <AnimatedListItem key={deal.id} index={index}>
                <DealCard deal={deal} brand={brandsById[deal.brandId]} onPress={() => navigation.navigate('DealDetailScreen', { id: deal.id })} />
              </AnimatedListItem>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
};

export default ForYouScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: SPACING.four,
    paddingTop: SPACING.three,
  },
  pageTitle: {
    ...TYPOGRAPHY.title,
  },
  subtitle: {
    ...TYPOGRAPHY.default,
    color: COLORS.textSecondary,
    marginTop: SPACING.one,
    marginBottom: SPACING.four,
  },
  list: {
    gap: SPACING.three,
  },
});
