import { useMemo } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import useFavoritesStore from '../../state/favoritesStore';
import AnimatedListItem from '../../components/AnimatedListItem';
import BrandCard from '../../components/BrandCard';
import DealCard from '../../components/DealCard';
import EmptyState from '../../components/EmptyState';
import TopAppBar from '../../components/TopAppBar';

const FavoritesScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const favoriteIds = useFavoritesStore((state) => state.favoriteIds);
  const deals = useDataStore((state) => state.deals);
  const brands = useDataStore((state) => state.brands);
  const brandsById = useDataStore((state) => state.brandsById);

  const favoriteDeals = useMemo(() => deals.filter((d) => favoriteIds.includes(d.id)), [deals, favoriteIds]);

  // Deliberately distinct from "Followed Brands" (usePreferencesStore) —
  // this is just brands with at least one saved deal, not the user's actual
  // follow list, so the section below is labeled differently to avoid
  // implying it's the same thing.
  const brandsWithSaves = useMemo(() => {
    const ids = new Set(favoriteDeals.map((d) => d.brandId));
    return brands.filter((b) => ids.has(b.id));
  }, [favoriteDeals, brands]);

  return (
    <View style={styles.container}>
      <TopAppBar hideProfile />
      {favoriteDeals.length === 0 ? (
        <EmptyState
          icon="heart-outline"
          title="No favorites yet"
          body="Tap the heart on any deal to save it here for quick access later."
          ctaLabel="Discover Deals"
          onPressCta={() => navigation.navigate('Home')}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}>
          <Text style={styles.heading}>Saved Deals</Text>
          <View style={styles.dealsList}>
            {favoriteDeals.map((deal, index) => (
              <AnimatedListItem key={deal.id} index={index}>
                <DealCard deal={deal} brand={brandsById[deal.brandId]} onPress={() => navigation.navigate('DealDetailScreen', { id: deal.id })} />
              </AnimatedListItem>
            ))}
          </View>

          {brandsWithSaves.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.heading}>From These Brands</Text>
              <FlatList
                horizontal
                data={brandsWithSaves}
                keyExtractor={(b) => b.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.brandRow}
                renderItem={({ item, index }) => (
                  <AnimatedListItem index={index}>
                    <BrandCard brand={item} onPress={() => navigation.navigate('BrandDetailScreen', { id: item.id })} />
                  </AnimatedListItem>
                )}
              />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};

export default FavoritesScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.three,
      gap: SPACING.four,
    },
    heading: {
      ...TYPOGRAPHY.headline,
      color: colors.text,
    },
    dealsList: {
      gap: SPACING.three,
      marginTop: SPACING.two,
    },
    section: {
      gap: SPACING.three,
    },
    brandRow: {
      gap: SPACING.three,
    },
  });
