import { useMemo } from 'react';
import { Linking, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FastImage from '@d11/react-native-fast-image';
import Icon from 'react-native-vector-icons/Ionicons';
import { SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useDataStore from '../../state/dataStore';
import AnimatedListItem from '../../components/AnimatedListItem';
import BrandLogo from '../../components/BrandLogo';
import CouponCodeBlock from '../../components/CouponCodeBlock';
import DealCardCompact from '../../components/DealCardCompact';
import EmptyState from '../../components/EmptyState';
import PrimaryButton from '../../components/PrimaryButton';
import SectionHeader from '../../components/SectionHeader';
import TopAppBar from '../../components/TopAppBar';

const expiryLabel = (expiresAt) => {
  if (!expiresAt) return 'No expiry';
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Expired';
  if (days === 0) return 'Ends today';
  if (days === 1) return 'Ends in 1 day';
  return `Ends in ${days} days`;
};

const DealDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const id = route.params?.id;
  const deals = useDataStore((state) => state.deals);
  const brandsById = useDataStore((state) => state.brandsById);

  const deal = useMemo(() => deals.find((d) => d.id === id), [deals, id]);
  const brand = deal ? brandsById[deal.brandId] : undefined;
  const relatedDeals = useMemo(
    () => (deal ? deals.filter((d) => d.brandId === deal.brandId && d.id !== deal.id).slice(0, 6) : []),
    [deals, deal],
  );

  if (!deal) {
    return (
      <View style={styles.container}>
        <TopAppBar showBack title="Deal Details" hideSearch hideProfile />
        <EmptyState
          icon="alert-circle-outline"
          title="Deal not found"
          body="This offer may have expired or been removed."
          ctaLabel="Go Back"
          onPressCta={() => navigation.goBack()}
        />
      </View>
    );
  }

  const linkUrl = deal.website ?? brand?.website ?? null;

  return (
    <View style={styles.container}>
      <TopAppBar
        showBack
        title="Deal Details"
        hideSearch
        hideProfile
        rightIcon="share-outline"
        onPressRight={() => Share.share({ message: `${deal.title} — ${deal.discountLabel}` })}
      />

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.four }} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <FastImage source={{ uri: deal.image }} style={styles.heroImage} resizeMode={FastImage.resizeMode.cover} />
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeLabel}>Up to {deal.discountLabel.replace('-', '')} OFF</Text>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.brandRow}>
            <BrandLogo initials={brand?.initials ?? '?'} size={44} />
            <View style={styles.brandText}>
              <View style={styles.brandNameRow}>
                <Text style={styles.brandName}>{brand?.name ?? 'Unknown brand'}</Text>
                {deal.isFeatured && <Icon name="checkmark-circle" size={16} color={colors.primary} />}
              </View>
              <Text style={styles.dealStatus}>{expiryLabel(deal.expiresAt) === 'Expired' ? 'Expired Deal' : 'Active Deal'}</Text>
            </View>
          </View>

          <Text style={styles.title}>{deal.title}</Text>

          <View style={styles.metaRow}>
            <Icon name="time-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.metaText}>{expiryLabel(deal.expiresAt)}</Text>
          </View>

          {deal.promoCode && (
            <View style={styles.section}>
              <CouponCodeBlock code={deal.promoCode} />
            </View>
          )}

          {deal.highlights.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionHeading}>Deal Highlights</Text>
              <View style={styles.divider} />
              <View style={styles.bulletList}>
                {deal.highlights.map((h, i) => (
                  <View key={i} style={styles.bulletRow}>
                    <Text style={styles.bulletDot}>{'•'}</Text>
                    <Text style={styles.bulletText}>{h}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.termsLabel}>TERMS & CONDITIONS</Text>
            <Text style={styles.terms}>{deal.terms}</Text>
          </View>
        </View>

        {relatedDeals.length > 0 && (
          <View style={styles.relatedSection}>
            <SectionHeader title="Similar Offers" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedList}>
              {relatedDeals.map((related, index) => (
                <AnimatedListItem key={related.id} index={index}>
                  <DealCardCompact deal={related} brand={brand} onPress={() => navigation.push('DealDetailScreen', { id: related.id })} />
                </AnimatedListItem>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.three }]}>
        <PrimaryButton label="Visit Store" icon="open-outline" disabled={!linkUrl} onPress={() => linkUrl && Linking.openURL(linkUrl)} />
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
    hero: {
      width: '100%',
      aspectRatio: 4 / 3,
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    heroBadge: {
      position: 'absolute',
      left: SPACING.three,
      bottom: SPACING.three,
      backgroundColor: '#F5CB1B',
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two,
      borderRadius: 999,
    },
    heroBadgeLabel: {
      ...TYPOGRAPHY.label,
      color: '#171717',
    },
    content: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.four,
      gap: SPACING.two,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.three,
    },
    brandText: {
      gap: 2,
    },
    brandNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    brandName: {
      ...TYPOGRAPHY.subtitle,
      color: colors.text,
    },
    dealStatus: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    title: {
      ...TYPOGRAPHY.headline,
      color: colors.text,
      marginTop: SPACING.two,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: SPACING.one,
    },
    metaText: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
    },
    section: {
      marginTop: SPACING.five,
      gap: SPACING.two,
    },
    sectionHeading: {
      ...TYPOGRAPHY.headline,
      color: colors.text,
      marginBottom: 0,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginBottom: SPACING.two,
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
      color: colors.text,
    },
    bulletText: {
      ...TYPOGRAPHY.default,
      color: colors.textSecondary,
      flex: 1,
      lineHeight: 20,
    },
    termsLabel: {
      ...TYPOGRAPHY.label,
      color: colors.textSecondary,
    },
    terms: {
      ...TYPOGRAPHY.small,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    relatedSection: {
      marginTop: SPACING.five,
      gap: SPACING.three,
    },
    relatedList: {
      paddingHorizontal: SPACING.four,
      gap: SPACING.three,
    },
    footer: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.three,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.surface,
    },
  });
