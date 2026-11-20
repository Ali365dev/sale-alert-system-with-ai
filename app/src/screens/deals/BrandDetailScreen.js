import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import FastImage from '@d11/react-native-fast-image';
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
import PhotoViewer from '../../components/PhotoViewer';
import CoverGallery from '../../components/CoverGallery';
import ViewSwitcher from '../../components/ViewSwitcher';
import useViewMode from '../../hooks/useViewMode';
import { BANK_CARD_OFFERS, getBankById, getOffersForBrand } from '../../config/banks';

const PAD = 20;
const GRID_GAP = 16;
const CARD_W = (SCREEN_WIDTH - PAD * 2 - GRID_GAP) / 2;
const COVER_H = (SCREEN_WIDTH * 9) / 16;

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

  // When this brand is also a scraped takhfif.app business, the bank-offers
  // API already joins that business's logo/cover/rating onto every offer row
  // (see app_server/routers/bank_offers.py's `_row_to_dict`) — so the first
  // offer with any of those fields set tells us "same business" without a
  // second request.
  const businessInfo = useMemo(
    () => bankOffers.find((o) => o.logoUrl || o.coverImageUrl || o.rating != null) ?? null,
    [bankOffers],
  );
  const [photoIdx, setPhotoIdx] = useState(null);
  const coverImageUrl = businessInfo?.coverImageUrl || brand?.coverImage || null;
  // Hero gallery: the business's cover shot first, followed by its other photos.
  const coverImages = useMemo(() => {
    const images = [coverImageUrl, ...(businessInfo?.gallery ?? [])].filter(Boolean);
    return [...new Set(images)];
  }, [coverImageUrl, businessInfo?.gallery]);

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

  // Collapse per-card rows into one row per bank — card-level detail (card
  // names, terms, expiry per card) only shows on BankOfferDetailScreen.
  const bankSummaries = useMemo(() => {
    const map = new Map();
    for (const offer of bankOffers) {
      const bank = getBankById(offer.bankId);
      if (!bank) continue;
      const entry = map.get(offer.bankId) ?? { bankId: offer.bankId, maxDiscount: 0, cardCount: 0, businessId: null, earliestExpiry: null };
      entry.cardCount += 1;
      entry.maxDiscount = Math.max(entry.maxDiscount, offer.discountPercent ?? 0);
      if (!entry.businessId && offer.businessId) entry.businessId = offer.businessId;
      if (offer.expiryDate && (!entry.earliestExpiry || offer.expiryDate < entry.earliestExpiry)) {
        entry.earliestExpiry = offer.expiryDate;
      }
      map.set(offer.bankId, entry);
    }
    return [...map.values()].sort((a, b) => b.maxDiscount - a.maxDiscount);
  }, [bankOffers]);

  const handleBankPress = useCallback((summary) => {
    const businessId = summary.businessId ?? businessInfo?.businessId ?? null;
    if (!businessId) return;
    const business = {
      id: businessId,
      name: brand.name,
      category: businessInfo?.category ?? null,
      city: businessInfo?.city ?? null,
      rating: businessInfo?.rating ?? null,
      review_count: businessInfo?.reviewCount ?? null,
      logo_url: businessInfo?.logoUrl ?? null,
      cover_image_url: businessInfo?.coverImageUrl ?? null,
      source_url: businessInfo?.sourceUrl ?? null,
      gallery: businessInfo?.gallery ?? [],
    };
    navigation.navigate('BankOfferDetailScreen', { business });
  }, [navigation, brand, businessInfo]);
  

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
            <View style={[styles.cover, !coverImages.length && { backgroundColor: colors.primary }]}>
              {coverImages.length > 0 && (
                <>
                  <CoverGallery images={coverImages} height={COVER_H} />
                  <View style={[StyleSheet.absoluteFillObject, styles.coverScrim]} pointerEvents="none" />
                </>
              )}
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
              <BrandLogo brand={brand} logoUrl={businessInfo?.logoUrl} size={56} tone="filled" elevated />
              <View style={styles.profileText}>
                <Text style={styles.brandName}>{brand.name}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.dealCount}>
                    {brand.dealCount} tracked offer{brand.dealCount === 1 ? '' : 's'}
                  </Text>
                  {businessInfo?.rating != null && (
                    <View style={styles.ratingBadge}>
                      <Icon name="star" size={10} color="#F59E0B" />
                      <Text style={styles.ratingText}>{Number(businessInfo.rating).toFixed(1)}</Text>
                      {!!businessInfo.reviewCount && (
                        <Text style={styles.ratingCount}>({businessInfo.reviewCount})</Text>
                      )}
                    </View>
                  )}
                </View>
                {/* Scraper occasionally mis-extracts city as a count string
                    (e.g. "515 cities") — a real city name never has digits. */}
                {!!businessInfo?.city && !/\d/.test(businessInfo.city) && (
                  <Text style={styles.cityText}>{businessInfo.city}</Text>
                )}
                {!!brand.description && (
                  <Text style={styles.description} numberOfLines={3}>
                    {brand.description}
                  </Text>
                )}
              </View>
            </View>

            {/* Gallery photos from the matched scraped business */}
            {businessInfo?.gallery?.length > 0 && (
              <View style={styles.gallerySection}>
                <Text style={styles.gallerySectionTitle}>Photos</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
                  {businessInfo.gallery.map((url, i) => (
                    <Pressable
                      key={url}
                      onPress={() => setPhotoIdx(i)}
                      accessibilityRole="button"
                      accessibilityLabel={`View photo ${i + 1}`}>
                      <FastImage
                        source={{ uri: url, priority: FastImage.priority.low, cache: FastImage.cacheControl.web }}
                        style={styles.galleryImg}
                        resizeMode={FastImage.resizeMode.cover}
                      />
                    </Pressable>
                  ))}
                </ScrollView>
                {photoIdx != null && (
                  <PhotoViewer images={businessInfo.gallery} startIndex={photoIdx} onClose={() => setPhotoIdx(null)} />
                )}
              </View>
            )}

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

            {/* Bank offers section — one row per bank; card-level detail lives on BankOfferDetailScreen */}
            {bankSummaries.length > 0 && (
              <View style={styles.bankOffersSection}>
                <Text style={styles.bankOffersTitle}>Bank Offers</Text>
                {bankSummaries.map((summary) => {
                  const bank = getBankById(summary.bankId);
                  if (!bank) return null;
                  const businessId = summary.businessId ?? businessInfo?.businessId ?? null;
                  const hasDetail = !!businessId;
                  const expiryLabel = summary.earliestExpiry
                    ? `Valid till ${new Date(summary.earliestExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                    : null;
                  return (
                    <Pressable
                      key={summary.bankId}
                      style={({ pressed }) => [styles.bankOfferRow, pressed && hasDetail && styles.bankOfferRowPressed]}
                      disabled={!hasDetail}
                      onPress={() => handleBankPress(summary)}
                      accessibilityRole={hasDetail ? 'button' : undefined}
                      accessibilityLabel={hasDetail ? `View ${bank.name} offer details` : undefined}>
                      <View style={[styles.bankInitials, { backgroundColor: bank.color }]}>
                        <Text style={styles.bankInitialsText}>{bank.initials}</Text>
                      </View>
                      <View style={styles.bankOfferBody}>
                        <View style={styles.bankOfferHeader}>
                          <View>
                            <Text style={styles.bankOfferName}>{bank.name}</Text>
                            <Text style={styles.bankOfferCardType}>
                              {summary.cardCount} card{summary.cardCount === 1 ? '' : 's'}
                            </Text>
                          </View>
                          <View style={styles.bankOfferDiscountCol}>
                            <Text style={styles.bankOfferDiscount}>Up to {summary.maxDiscount}% OFF</Text>
                            {expiryLabel && (
                              <View style={styles.tagExpiry}>
                                <Text style={styles.tagExpiryText}>{expiryLabel}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      {hasDetail && (
                        <Icon name="chevron-forward" size={16} color={colors.textSecondary} style={styles.bankOfferChevron} />
                      )}
                    </Pressable>
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
      overflow: 'hidden',
    },
    coverScrim: {
      backgroundColor: 'rgba(0,0,0,0.28)',
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
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    ratingBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: '#FEF3C7',
    },
    ratingText: { fontSize: 11, fontWeight: '700', color: '#92400E' },
    ratingCount: { fontSize: 10, fontWeight: '500', color: '#92400E', opacity: 0.8 },
    cityText: {
      fontSize: 12,
      lineHeight: 16,
      color: colors.textSecondary,
      marginTop: 2,
    },
    description: {
      marginTop: 4,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textSecondary,
    },
    gallerySection: {
      marginHorizontal: PAD,
      marginTop: 16,
    },
    gallerySectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      marginBottom: 8,
    },
    galleryRow: {
      gap: 8,
    },
    galleryImg: {
      width: 160,
      height: 100,
      borderRadius: 12,
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
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#EDF0F3',
      padding: 14,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 2,
    },
    bankOfferRowPressed: {
      backgroundColor: colors.backgroundElement,
    },
    bankOfferChevron: {
      flexShrink: 0,
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
    bankOfferDiscountCol: { alignItems: 'flex-end' },
    bankOfferDiscount: { fontSize: 15, fontWeight: '900', color: '#F20D38' },
    tagExpiry: {
      alignSelf: 'flex-end',
      marginTop: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      backgroundColor: '#FFF3CD',
      borderRadius: 6,
    },
    tagExpiryText: { fontSize: 11, fontWeight: '600', color: '#856404' },
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
