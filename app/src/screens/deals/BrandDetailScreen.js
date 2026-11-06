import { useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Screen from '../../components/Screen';
import Icon from 'react-native-vector-icons/Ionicons';
import { SCREEN_WIDTH } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import usePreferencesStore from '../../state/preferencesStore';
import useBankCardsStore from '../../state/bankCardsStore';
import useBankOffersStore from '../../state/bankOffersStore';
import { loadBankCardOffers } from '../../services/bankOffersApi';
import { toggleFollowStore } from '../../utils/authGate';
import AnimatedListItem from '../../components/AnimatedListItem';
import BrandLogo from '../../components/BrandLogo';
import CouponCard from '../../components/CouponCard';
import { useCouponSheet } from '../../components/CouponSheet';
import EmptyState from '../../components/EmptyState';
import ViewSwitcher from '../../components/ViewSwitcher';
import useViewMode from '../../hooks/useViewMode';
import { BANK_CARD_OFFERS, CARD_TYPE_LABELS, getBankById, getOffersForBrand } from '../../config/banks';

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
  const savedCards = useBankCardsStore((s) => s.cards);
  const fetchedBankOffers = useBankOffersStore((s) => s.offers);
  const [gridView, setGridView] = useViewMode(false);
  const { openCoupon, couponSheet } = useCouponSheet();

  useEffect(() => {
    loadBankCardOffers();
  }, []);

  const brand = useMemo(() => brands.find((b) => b.id === id), [brands, id]);
  const brandDeals = useMemo(() => deals.filter((d) => d.brandId === id), [deals, id]);
  const isFollowing = brand ? followedBrands.includes(brand.name) : false;

  // Live, scraped offers (takhfif.app) layered on top of the static seed
  // array — see services/bankOffersApi.js.
  const combinedOffers = useMemo(
    () => [...BANK_CARD_OFFERS, ...fetchedBankOffers],
    [fetchedBankOffers],
  );
  const bankOffers = useMemo(
    () => (brand ? getOffersForBrand(brand.id, combinedOffers) : []),
    [brand, combinedOffers],
  );

  // Personalized banner: find the first saved card that matches a bank offer
  const qualifyingCard = useMemo(() => {
    if (!bankOffers.length || !savedCards.length) return null;
    const offerBankIds = new Set(bankOffers.map((o) => o.bankId));
    return savedCards.find((c) => offerBankIds.has(c.bankId)) ?? null;
  }, [bankOffers, savedCards]);

  const qualifyingBank = qualifyingCard ? getBankById(qualifyingCard.bankId) : null;
  const qualifyingOffer = qualifyingCard
    ? bankOffers.find((o) => o.bankId === qualifyingCard.bankId)
    : null;

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
      <Screen style={styles.container}>
        <EmptyState
          icon="alert-circle-outline"
          title="Brand not found"
          body="This brand may have been removed or is no longer tracked."
          ctaLabel="Go Back"
          onPressCta={() => navigation.goBack()}
        />
      </Screen>
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

            {/* Personalized qualifying card banner */}
            {qualifyingCard && qualifyingBank && qualifyingOffer && (
              <Pressable
                onPress={() => navigation.navigate('MyCardsScreen')}
                style={styles.qualifyBanner}
                accessibilityRole="button">
                <Icon name="card-outline" size={20} color="#FFFFFF" />
                <View style={styles.qualifyText}>
                  <Text style={styles.qualifyTitle}>
                    Your {qualifyingBank.name} {qualifyingCard.cardType} card qualifies!
                  </Text>
                  <Text style={styles.qualifySub}>
                    Get up to {qualifyingOffer.discountPercent}% cashback on your next visit
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
              </Pressable>
            )}

            {/* Bank card offers section */}
            {bankOffers.length > 0 && (
              <View style={styles.bankOffersSection}>
                <Text style={styles.bankOffersTitle}>All Card Offers</Text>
                {bankOffers.map((offer) => {
                  const bank = getBankById(offer.bankId);
                  if (!bank) return null;
                  const expiryLabel = offer.expiryDate
                    ? `Expires ${new Date(offer.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                    : null;
                  const daysLabel =
                    offer.daysValid === 'all'
                      ? 'All days'
                      : Array.isArray(offer.daysValid) && offer.daysValid.length
                        ? offer.daysValid.length <= 2
                          ? offer.daysValid.join(' & ')
                          : 'Weekends only'
                        : null;
                  return (
                    <View key={offer.id} style={styles.bankOfferRow}>
                      <View style={[styles.bankInitials, { backgroundColor: bank.color }]}>
                        <Text style={styles.bankInitialsText}>{bank.initials}</Text>
                      </View>
                      <View style={styles.bankOfferBody}>
                        <View style={styles.bankOfferHeader}>
                          <View>
                            <Text style={styles.bankOfferName}>{bank.name}</Text>
                            <Text style={styles.bankOfferCardType}>
                              {CARD_TYPE_LABELS[offer.cardType] ?? offer.cardType}
                            </Text>
                          </View>
                          <Text style={styles.bankOfferDiscount}>{offer.discountPercent}% OFF</Text>
                        </View>
                        <Text style={styles.bankOfferDesc} numberOfLines={2}>{offer.description}</Text>
                        <View style={styles.bankOfferTags}>
                          {expiryLabel && (
                            <View style={styles.tagExpiry}>
                              <Text style={styles.tagExpiryText}>{expiryLabel}</Text>
                            </View>
                          )}
                          {daysLabel && (
                            <View style={styles.tagDays}>
                              <Text style={styles.tagDaysText}>{daysLabel}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

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
    qualifyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: PAD,
      marginTop: 16,
      backgroundColor: '#1A5276',
      borderRadius: 14,
      padding: 14,
    },
    qualifyText: { flex: 1 },
    qualifyTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
    qualifySub: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginTop: 2 },
    bankOffersSection: {
      marginHorizontal: PAD,
      marginTop: 20,
    },
    bankOffersTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 12,
    },
    bankOfferRow: {
      flexDirection: 'row',
      gap: 12,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    bankInitials: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    bankInitialsText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
    bankOfferBody: { flex: 1 },
    bankOfferHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 6,
    },
    bankOfferName: { fontSize: 15, fontWeight: '700', color: colors.text },
    bankOfferCardType: { fontSize: 12, color: colors.textSecondary, marginTop: 1 },
    bankOfferDiscount: { fontSize: 15, fontWeight: '900', color: '#F20D38' },
    bankOfferDesc: { fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    bankOfferTags: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
    tagExpiry: {
      paddingHorizontal: 8, paddingVertical: 3,
      backgroundColor: '#FFF3CD', borderRadius: 6,
    },
    tagExpiryText: { fontSize: 11, fontWeight: '600', color: '#856404' },
    tagDays: {
      paddingHorizontal: 8, paddingVertical: 3,
      backgroundColor: '#E8D5FF', borderRadius: 6,
    },
    tagDaysText: { fontSize: 11, fontWeight: '600', color: '#6B2DA8' },
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
