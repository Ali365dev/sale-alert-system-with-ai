import { useMemo } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useDataStore from '../../state/dataStore';
import DealCard from '../../components/DealCard';
import EmptyState from '../../components/EmptyState';

const BrandDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const id = route.params?.id;
  const brands = useDataStore((state) => state.brands);
  const deals = useDataStore((state) => state.deals);

  const brand = useMemo(() => brands.find((b) => b.id === id), [brands, id]);
  const brandDeals = useMemo(() => deals.filter((d) => d.brandId === id), [deals, id]);

  if (!brand) {
    return (
      <View style={styles.container}>
        <EmptyState icon="alert-circle-outline" title="Brand not found" body="" ctaLabel="Go Back" onPressCta={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={brandDeals}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.four }}
        ListHeaderComponent={
          <>
            <View style={styles.cover}>
              <FastImage source={{ uri: brand.coverImage }} style={styles.coverImage} resizeMode={FastImage.resizeMode.cover} />
              <View style={[styles.topBar, { paddingTop: insets.top + SPACING.two }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.circleButton}>
                  <Icon name="chevron-back" size={22} color="#171717" />
                </Pressable>
              </View>
            </View>
            <View style={styles.header}>
              <Text style={styles.brandName}>{brand.name}</Text>
              <Text style={styles.dealCount}>{brand.dealCount} tracked offers</Text>
              <Text style={styles.description}>{brand.description}</Text>
              {brand.website && (
                <Pressable onPress={() => Linking.openURL(brand.website)}>
                  <Text style={styles.website}>{brand.website}</Text>
                </Pressable>
              )}
            </View>
            <Text style={styles.sectionTitle}>Current Offers</Text>
          </>
        }
        renderItem={({ item }) => (
          <DealCard deal={item} brand={brand} onPress={() => navigation.navigate('DealDetailScreen', { id: item.id })} style={styles.card} />
        )}
        ListEmptyComponent={<Text style={styles.empty}>No offers tracked for this brand yet.</Text>}
      />
    </View>
  );
};

export default BrandDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  cover: {
    width: '100%',
    aspectRatio: 16 / 9,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.four,
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingHorizontal: SPACING.four,
    paddingTop: SPACING.three,
    gap: SPACING.one,
  },
  brandName: {
    ...TYPOGRAPHY.title,
  },
  dealCount: {
    ...TYPOGRAPHY.small,
    color: '#6B7280',
  },
  description: {
    ...TYPOGRAPHY.default,
    color: '#6B7280',
    marginTop: SPACING.two,
    lineHeight: 22,
  },
  website: {
    ...TYPOGRAPHY.linkPrimary,
  },
  sectionTitle: {
    ...TYPOGRAPHY.headline,
    paddingHorizontal: SPACING.four,
    marginTop: SPACING.five,
    marginBottom: SPACING.two,
  },
  card: {
    marginHorizontal: SPACING.four,
    marginBottom: SPACING.three,
  },
  empty: {
    ...TYPOGRAPHY.small,
    color: '#6B7280',
    paddingHorizontal: SPACING.four,
  },
});
