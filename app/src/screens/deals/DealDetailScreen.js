import { useMemo } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Screen from '../../components/Screen';
import { SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import useFavoritesStore from '../../state/favoritesStore';
import { channelTag, formatDiscountDisplay, formatExpiryShort } from '../../utils/dealAdapters';
import { toggleFavoriteDeal } from '../../utils/authGate';
import BrandLogo from '../../components/BrandLogo';
import CouponCodeBlock from '../../components/CouponCodeBlock';
import DealHero from '../../components/DealHero';
import EmptyState from '../../components/EmptyState';
import FavoriteButton from '../../components/FavoriteButton';
import PrimaryButton from '../../components/PrimaryButton';
import TopAppBar from '../../components/TopAppBar';

const DAY_MS = 24 * 60 * 60 * 1000;

const termsToBullets = (terms) =>
  String(terms || '')
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 5);

const expiryInfo = (expiresAt) => {
  if (!expiresAt) return { label: 'Ongoing offer', urgent: false };
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / DAY_MS);
  if (days < 0) return { label: 'Expired', urgent: true };
  if (days === 0) return { label: 'Ends today', urgent: true };
  if (days === 1) return { label: 'Ends tomorrow', urgent: true };
  if (days <= 7) return { label: `Ends in ${days} days`, urgent: false };
  return { label: formatExpiryShort(expiresAt), urgent: false };
};

const InfoChip = ({ icon, label, styles, color }) => (
  <View style={styles.infoChip}>
    <Icon name={icon} size={14} color={color} />
    <Text style={styles.infoChipText}>{label}</Text>
  </View>
);

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

  const deal = useMemo(() => deals.find((d) => d.id === id), [deals, id]);
  const brand = deal ? brandsById[deal.brandId] : undefined;

  if (!deal) {
    return (
      <Screen style={styles.container}>
        <TopAppBar showBack title="Coupon Details" hideProfile hideBorder />
        <EmptyState
          icon="alert-circle-outline"
          title="Coupon not found"
          body="This offer may have expired or been removed."
          ctaLabel="Go Back"
          onPressCta={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  const linkUrl = deal.website ?? brand?.website ?? null;
  const tag = channelTag(deal);
  const expiry = expiryInfo(deal.expiresAt);
  const highlights = deal.highlights?.length > 0 ? deal.highlights : null;
  const bullets = highlights ?? termsToBullets(deal.terms);
  const brandName = brand?.name ?? 'Featured store';
  const showAbout = deal.description && deal.description !== deal.title;

  return (
    <Screen style={styles.container}>
      <TopAppBar
        showBack
        title="Coupon Details"
        hideProfile
        hideBorder
        rightSlot={<FavoriteButton active={favorite} onPress={() => toggleFavoriteDeal(deal.id)} />}
      />

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: SPACING.four }]} showsVerticalScrollIndicator={false}>
        <DealHero
          deal={deal}
          brand={brand}
          badge={formatDiscountDisplay(deal)}
          expiryLabel={expiry.label}
          expiryUrgent={expiry.urgent}
        />

        <View style={styles.headerBlock}>
          <Pressable
            style={({ pressed }) => [styles.brandRow, pressed && styles.pressed]}
            disabled={!brand?.id}
            onPress={() => navigation.navigate('BrandDetailScreen', { id: brand.id })}
            accessibilityRole="button"
            accessibilityLabel={`View ${brandName} brand details`}>
            <BrandLogo
              initials={brand?.initials ?? '?'}
              logoUrl={brand?.logoUrl}
              website={brand?.website}
              logoScale={brand?.logoScale}
              logoOffsetX={brand?.logoOffsetX}
              logoOffsetY={brand?.logoOffsetY}
              size={44}
              tone="filled"
            />
            <View style={styles.brandText}>
              <Text style={styles.brandName} numberOfLines={1}>
                {brandName}
              </Text>
              {brand?.id ? (
                <Text style={styles.brandMeta} numberOfLines={1}>
                  See all {brandName} deals
                </Text>
              ) : null}
            </View>
            {brand?.id ? <Icon name="chevron-forward" size={18} color={colors.textSecondary} /> : null}
          </Pressable>

          <Text style={styles.title}>{deal.title}</Text>

          <View style={styles.infoRow}>
            <InfoChip icon="storefront-outline" label={tag} styles={styles} color={colors.primary} />
            <InfoChip icon="pricetags-outline" label={deal.category} styles={styles} color={colors.primary} />
            {deal.isFeatured ? <InfoChip icon="shield-checkmark-outline" label="Verified" styles={styles} color={colors.success} /> : null}
          </View>
        </View>

        {deal.promoCode ? (
          <CouponCodeBlock code={deal.promoCode} />
        ) : (
          <View style={styles.noCode}>
            <Icon name="flash-outline" size={18} color={colors.success} />
            <Text style={styles.noCodeText}>No code needed — the discount applies automatically.</Text>
          </View>
        )}

        {showAbout ? (
          <View style={styles.card}>
            <Text style={styles.sectionHeading}>About this offer</Text>
            <Text style={styles.about}>{deal.description}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionHeading}>{highlights ? 'Highlights' : 'Terms & Conditions'}</Text>
          <View style={styles.bulletList}>
            {bullets.map((item, index) => (
              <View key={`${index}-${item.slice(0, 12)}`} style={styles.bulletRow}>
                <Icon name="checkmark-circle" size={18} color={colors.primary} style={styles.bulletIcon} />
                <Text style={styles.bulletText}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.three }]}>
        <PrimaryButton
          label={linkUrl ? `Shop at ${brandName}` : 'Store link unavailable'}
          pill
          disabled={!linkUrl}
          onPress={() => linkUrl && Linking.openURL(linkUrl)}
        />
      </View>
    </Screen>
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
      paddingHorizontal: SPACING.four - 4,
      paddingTop: SPACING.two,
      gap: SPACING.three + 4,
    },
    headerBlock: {
      gap: 12,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 48,
    },
    pressed: {
      opacity: 0.7,
    },
    brandText: {
      flex: 1,
      minWidth: 0,
    },
    brandName: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    brandMeta: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    title: {
      ...TYPOGRAPHY.headline,
      color: colors.text,
    },
    infoRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    infoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    infoChipText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    noCode: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: SPACING.three,
      borderRadius: 16,
      backgroundColor: colors.successBg,
    },
    noCodeText: {
      ...TYPOGRAPHY.small,
      flex: 1,
      fontWeight: '600',
      color: colors.text,
    },
    card: {
      gap: 12,
      padding: SPACING.three + 2,
      borderRadius: 20,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      ...SHADOWS.card,
    },
    sectionHeading: {
      ...TYPOGRAPHY.subtitle,
      color: colors.text,
    },
    about: {
      ...TYPOGRAPHY.default,
      fontWeight: '400',
      color: colors.textSecondary,
    },
    bulletList: {
      gap: 12,
    },
    bulletRow: {
      flexDirection: 'row',
      gap: 10,
    },
    bulletIcon: {
      marginTop: 3,
    },
    bulletText: {
      ...TYPOGRAPHY.default,
      fontWeight: '400',
      color: colors.text,
      flex: 1,
    },
    footer: {
      paddingHorizontal: SPACING.four - 4,
      paddingTop: SPACING.three,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
  });
