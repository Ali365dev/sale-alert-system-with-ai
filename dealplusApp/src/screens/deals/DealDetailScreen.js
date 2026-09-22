import { useMemo } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import useFavoritesStore from '../../state/favoritesStore';
import { channelTag, formatDiscountDisplay, formatExpiryShort } from '../../utils/dealAdapters';
import BrandLogo from '../../components/BrandLogo';
import CouponCodeBlock from '../../components/CouponCodeBlock';
import EmptyState from '../../components/EmptyState';
import FavoriteButton from '../../components/FavoriteButton';
import PrimaryButton from '../../components/PrimaryButton';
import TopAppBar from '../../components/TopAppBar';

const termsToBullets = (terms) =>
  String(terms || '')
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 5);

const DealDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const id = route.params?.id;
  const deals = useDataStore((state) => state.deals);
  const brandsById = useDataStore((state) => state.brandsById);
  const favorite = useFavoritesStore((state) => state.favoriteIds.includes(id));
  const toggleFavorite = useFavoritesStore((state) => state.toggleFavorite);

  const deal = useMemo(() => deals.find((d) => d.id === id), [deals, id]);
  const brand = deal ? brandsById[deal.brandId] : undefined;

  if (!deal) {
    return (
      <View style={styles.container}>
        <TopAppBar showBack title="Coupon Details" hideSearch hideProfile hideBorder />
        <EmptyState
          icon="alert-circle-outline"
          title="Coupon not found"
          body="This offer may have expired or been removed."
          ctaLabel="Go Back"
          onPressCta={() => navigation.goBack()}
        />
      </View>
    );
  }

  const linkUrl = deal.website ?? brand?.website ?? null;
  const tag = channelTag(deal);
  const bullets = deal.highlights?.length > 0 ? deal.highlights : termsToBullets(deal.terms);

  return (
    <View style={styles.container}>
      <TopAppBar
        showBack
        title="Coupon Details"
        hideSearch
        hideProfile
        hideBorder
        rightSlot={<FavoriteButton active={favorite} onPress={() => toggleFavorite(deal.id)} />}
      />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <BrandLogo initials={brand?.initials ?? '?'} logoUrl={brand?.logoUrl} website={brand?.website} size={56} tone="filled" />
          <View style={styles.summaryBody}>
            <Text style={styles.brandName}>{brand?.name ?? 'Unknown brand'}</Text>
            <Text style={styles.offerTitle} numberOfLines={2}>
              {deal.title}
            </Text>
            <Text style={styles.offerMeta} numberOfLines={1}>
              {deal.description}
            </Text>
            <View style={styles.tag}>
              <Text style={styles.tagLabel}>{tag}</Text>
            </View>
          </View>
          <View style={styles.summaryRight}>
            <Text style={styles.discount}>{formatDiscountDisplay(deal)}</Text>
            <Text style={styles.expiry}>{formatExpiryShort(deal.expiresAt)}</Text>
          </View>
        </View>

        {deal.promoCode ? (
          <View style={styles.section}>
            <CouponCodeBlock code={deal.promoCode} />
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>About this offer</Text>
          <Text style={styles.about}>{deal.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Terms & Conditions</Text>
          <View style={styles.bulletList}>
            {bullets.map((item, index) => (
              <View key={`${index}-${item.slice(0, 12)}`} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.three }]}>
        <PrimaryButton label="Shop Now" pill disabled={!linkUrl} onPress={() => linkUrl && Linking.openURL(linkUrl)} />
      </View>
    </View>
  );
};

export default DealDetailScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.three,
      gap: SPACING.four,
    },
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.three,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: SPACING.three,
      ...SHADOWS.card,
    },
    summaryBody: {
      flex: 1,
      gap: 2,
      minWidth: 0,
    },
    brandName: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
      fontSize: 16,
    },
    offerTitle: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
      fontSize: 14,
    },
    offerMeta: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
      fontSize: 12,
    },
    tag: {
      alignSelf: 'flex-start',
      marginTop: 6,
      backgroundColor: colors.tagBackground,
      borderRadius: RADIUS.chip,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    tagLabel: {
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.4,
      color: colors.primary,
    },
    summaryRight: {
      alignItems: 'flex-end',
      gap: 4,
      maxWidth: 100,
    },
    discount: {
      ...TYPOGRAPHY.smallBold,
      color: colors.primary,
      fontSize: 18,
      textAlign: 'right',
    },
    expiry: {
      fontSize: 11,
      color: colors.textSecondary,
      textAlign: 'right',
    },
    section: {
      gap: SPACING.two,
    },
    sectionHeading: {
      ...TYPOGRAPHY.subtitle,
      color: colors.text,
      fontSize: 17,
    },
    about: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      lineHeight: 22,
    },
    bulletList: {
      gap: SPACING.two,
    },
    bulletRow: {
      flexDirection: 'row',
      gap: SPACING.two,
    },
    bulletDot: {
      ...TYPOGRAPHY.default,
      color: colors.primary,
      fontWeight: '800',
    },
    bulletText: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 22,
    },
    footer: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.three,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
  });
