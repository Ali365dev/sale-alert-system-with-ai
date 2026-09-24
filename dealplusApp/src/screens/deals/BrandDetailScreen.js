import { useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { SCREEN_WIDTH } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import { toggleFollowStore } from '../../utils/authGate';
import AnimatedListItem from '../../components/AnimatedListItem';
import BrandLogo from '../../components/BrandLogo';
import CouponCard from '../../components/CouponCard';
import { useCouponSheet } from '../../components/CouponSheet';
import EmptyState from '../../components/EmptyState';
import ViewSwitcher from '../../components/ViewSwitcher';
import useViewMode from '../../hooks/useViewMode';

const PAD = 20;
const GRID_GAP = 16;
const CARD_W = (SCREEN_WIDTH - PAD * 2 - GRID_GAP) / 2;

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
  const [gridView, setGridView] = useViewMode(false);
  const { openCoupon, couponSheet } = useCouponSheet();

  const brand = useMemo(() => brands.find((b) => b.id === id), [brands, id]);
  const brandDeals = useMemo(() => deals.filter((d) => d.brandId === id), [deals, id]);
  const isFollowing = brand ? followedBrands.includes(brand.name) : false;

  const handleToggleFollow = () => {
    if (!brand) return;
    toggleFollowStore(brand.name);
  };

  const handleShare = () => {
    if (!brand) return;
    Share.share({
      title: brand.name,
      message: brand.website ? `${brand.name}\n${brand.website}` : brand.name,
      url: brand.website || undefined,
    }).catch(() => {});
  };

  const handleShopNow = () => {
    if (brand?.website) Linking.openURL(brand.website);
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
        key={gridView ? 'brand-coupons-grid' : 'brand-coupons-list'}
        data={brandDeals}
        keyExtractor={(d) => d.id}
        numColumns={gridView ? 2 : 1}
        columnWrapperStyle={gridView ? styles.gridRow : undefined}
        contentContainerStyle={{ paddingBottom: insets.bottom + (brand.website ? 108 : 32) }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <>
            <View style={[styles.cover, { backgroundColor: colors.primary }]}>
              <View style={[styles.coverBar, { paddingTop: insets.top + 8 }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.circleButton} accessibilityRole="button" accessibilityLabel="Go back">
                  <Icon name="chevron-back" size={20} color={colors.text} />
                </Pressable>
                <View style={styles.coverActions}>
                  <Pressable onPress={handleShare} style={styles.circleButton} accessibilityRole="button" accessibilityLabel="Share store">
                    <Icon name="share-outline" size={18} color={colors.text} />
                  </Pressable>
                  <Pressable
                    onPress={handleToggleFollow}
                    style={styles.circleButton}
                    accessibilityRole="button"
                    accessibilityLabel={isFollowing ? 'Unfollow brand' : 'Follow brand'}>
                    <Icon name={isFollowing ? 'heart' : 'heart-outline'} size={18} color={colors.primary} />
                  </Pressable>
                </View>
              </View>
            </View>

            <View style={styles.profileCard}>
              <BrandLogo brand={brand} size={56} tone="filled" fit="cover" elevated />
              <View style={styles.profileText}>
                <Text style={styles.brandName}>{brand.name}</Text>
                <Text style={styles.dealCount}>
                  {brand.dealCount} tracked offer{brand.dealCount === 1 ? '' : 's'}
                </Text>
                {!!brand.description && (
                  <Text style={styles.description} numberOfLines={3}>
                    {brand.description}
                  </Text>
                )}
              </View>
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>Available Coupons</Text>
              <ViewSwitcher gridView={gridView} onChange={setGridView} />
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <AnimatedListItem index={index} style={gridView ? styles.gridItem : styles.listItem}>
            <CouponCard
              deal={item}
              brand={brand}
              variant={gridView ? 'vertical' : 'horizontal'}
              onPress={() => openCoupon(item)}
            />
          </AnimatedListItem>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No coupons tracked for this brand yet.</Text>}
      />

      {brand.website ? (
        <View style={[styles.shopBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Pressable
            onPress={handleShopNow}
            style={[styles.shopBtn, { backgroundColor: colors.primary }]}
            accessibilityRole="button"
            accessibilityLabel={`Shop now at ${brand.name}`}>
            <Text style={styles.shopLabel}>Shop Now at {brand.name}</Text>
            <Icon name="open-outline" size={16} color="#FFFFFF" />
          </Pressable>
        </View>
      ) : null}

      {couponSheet}
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
      backgroundColor: colors.primary,
    },
    coverBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingHorizontal: PAD,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    coverActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    circleButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.88)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    profileCard: {
      marginTop: -28,
      marginHorizontal: PAD,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#EDF0F3',
      padding: 16,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 2,
    },
    profileText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    brandName: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '800',
      color: colors.text,
    },
    dealCount: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    description: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    sectionHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: PAD,
      marginTop: 24,
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    listItem: {
      marginHorizontal: PAD,
      marginBottom: 16,
      overflow: 'visible',
    },
    gridRow: {
      paddingHorizontal: PAD,
      gap: GRID_GAP,
    },
    gridItem: {
      width: CARD_W,
      marginBottom: GRID_GAP,
      overflow: 'visible',
    },
    empty: {
      paddingHorizontal: PAD,
      fontSize: 14,
      color: colors.textSecondary,
    },
    shopBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderTopWidth: 1,
      borderTopColor: '#EDF0F3',
      paddingHorizontal: 20,
      paddingTop: 12,
    },
    shopBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      minHeight: 48,
    },
    shopLabel: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '800',
    },
  });
