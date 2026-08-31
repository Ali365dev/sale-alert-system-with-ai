import { useMemo } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import { saveInterests } from '../../services/preferencesApi';
import AnimatedListItem from '../../components/AnimatedListItem';
import DealCard from '../../components/DealCard';
import EmptyState from '../../components/EmptyState';

const BrandDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const id = route.params?.id;
  const brands = useDataStore((state) => state.brands);
  const deals = useDataStore((state) => state.deals);
  const followedBrands = usePreferencesStore((state) => state.followedBrands);
  const toggleFollowedBrand = usePreferencesStore((state) => state.toggleFollowedBrand);

  const brand = useMemo(() => brands.find((b) => b.id === id), [brands, id]);
  const brandDeals = useMemo(() => deals.filter((d) => d.brandId === id), [deals, id]);
  const isFollowing = brand ? followedBrands.includes(brand.name) : false;

  const handleToggleFollow = () => {
    if (!brand) return;
    toggleFollowedBrand(brand.name);
    saveInterests({ brands: usePreferencesStore.getState().followedBrands });
  };

  if (!brand) {
    return (
      <View style={styles.container}>
        <EmptyState
          icon="alert-circle-outline"
          title="Brand not found"
          body="This brand may have been removed or is no longer tracked."
          ctaLabel="Go Back"
          onPressCta={() => navigation.goBack()}
        />
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
              <View style={styles.titleRow}>
                <View style={styles.titleTextWrap}>
                  <Text style={styles.brandName}>{brand.name}</Text>
                  <Text style={styles.dealCount}>{brand.dealCount} tracked offers</Text>
                </View>
                <Pressable
                  onPress={handleToggleFollow}
                  style={[styles.followButton, isFollowing && styles.followButtonActive]}>
                  <Icon name={isFollowing ? 'checkmark' : 'add'} size={16} color={isFollowing ? '#FFFFFF' : colors.primary} />
                  <Text style={[styles.followButtonLabel, isFollowing && styles.followButtonLabelActive]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
              </View>
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
        renderItem={({ item, index }) => (
          <AnimatedListItem index={index} style={styles.card}>
            <DealCard deal={item} brand={brand} onPress={() => navigation.navigate('DealDetailScreen', { id: item.id })} />
          </AnimatedListItem>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No offers tracked for this brand yet.</Text>}
      />
    </View>
  );
};

export default BrandDetailScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
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
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: SPACING.three,
    },
    titleTextWrap: {
      flex: 1,
      gap: 1,
    },
    followButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1.5,
      borderColor: colors.primary,
      borderRadius: RADIUS.chip,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two,
    },
    followButtonActive: {
      backgroundColor: colors.primary,
    },
    followButtonLabel: {
      ...TYPOGRAPHY.smallBold,
      color: colors.primary,
    },
    followButtonLabelActive: {
      color: '#FFFFFF',
    },
    brandName: {
      ...TYPOGRAPHY.title,
      color: colors.text,
    },
    dealCount: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    description: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      marginTop: SPACING.two,
      lineHeight: 22,
    },
    website: {
      ...TYPOGRAPHY.linkPrimary,
    },
    sectionTitle: {
      ...TYPOGRAPHY.headline,
      color: colors.text,
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
      color: colors.textSecondary,
      paddingHorizontal: SPACING.four,
    },
  });
