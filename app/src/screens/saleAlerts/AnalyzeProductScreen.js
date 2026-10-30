import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import EmptyState from '../../components/EmptyState';
import OnboardingProgress from '../../components/OnboardingProgress';
import ProductImage, { normalizeProductImageUrl } from '../../components/ProductImage';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';
import useDataStore from '../../state/dataStore';
import { analyzeProductUrl } from '../../services/saleAlertsApi';
import { formatSalePrice } from '../../utils/formatSalePrice';
import { findBrandLogo, resolveSaleAlertImage } from '../../utils/saleAlertImage';

const AnalyzeProductScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const url = route.params?.url;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setProductFields = useCreateAlertDraftStore((s) => s.setProductFields);
  const productName = useCreateAlertDraftStore((s) => s.productName);
  const brandName = useCreateAlertDraftStore((s) => s.brandName);
  const currentPrice = useCreateAlertDraftStore((s) => s.currentPrice);
  const originalPrice = useCreateAlertDraftStore((s) => s.originalPrice);
  const productUrl = useCreateAlertDraftStore((s) => s.productUrl);
  const imageUrl = useCreateAlertDraftStore((s) => s.imageUrl);
  const alreadyOnSale = useCreateAlertDraftStore((s) => s.alreadyOnSale);
  const discountPct = useCreateAlertDraftStore((s) => s.discountPct);
  const brands = useDataStore((s) => s.brands);
  const [phase, setPhase] = useState('loading'); // loading | success | fail
  const [errorMsg, setErrorMsg] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  const brandLogoUri = findBrandLogo(brandName, brands);
  const displayImage =
    previewImage ||
    resolveSaleAlertImage(
      { imageUrl, brandName },
      brands,
    );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await analyzeProductUrl(url);
        if (cancelled) return;
        if (!result?.ok && !result?.product_name && result?.current_price == null) {
          setProductFields({
            productUrl: url,
            analyzeFailed: true,
            analyzePartial: false,
          });
          setErrorMsg(result?.error || 'Product details could not be identified automatically.');
          setPhase('fail');
          return;
        }
        const nextBrand = result.brand_name || '';
        const nextImage =
          normalizeProductImageUrl(result.image_url) ||
          normalizeProductImageUrl(result.brand_logo_url) ||
          normalizeProductImageUrl(resolveSaleAlertImage({ brandName: nextBrand }, brands)) ||
          '';
        setPreviewImage(nextImage || null);
        const nextName = result.product_name || '';
        const nextCurrent = result.current_price ?? null;
        const onSale = !!result.already_on_sale;
        setProductFields({
          productUrl: result.product_url || url,
          productName: nextName,
          brandName: nextBrand,
          currentPrice: nextCurrent,
          originalPrice: result.original_price ?? null,
          imageUrl: nextImage,
          sku: result.sku || '',
          alreadyOnSale: onSale,
          discountPct: result.discount_pct ?? null,
          alreadyOnSaleChoice: onSale ? 'notify_now' : 'notify_now',
          analyzeFailed: false,
          analyzePartial: !!result.partial || !nextName || !nextBrand || nextCurrent == null,
        });
        // Name is enough to preview; brand/price can be completed on Edit Details.
        if (nextName) setPhase('success');
        else {
          setErrorMsg(result?.error || 'Some details are missing — you can fill them in.');
          setPhase('fail');
        }
      } catch (e) {
        if (cancelled) return;
        setProductFields({ productUrl: url, analyzeFailed: true });
        setErrorMsg(
          e?.message ||
            e?.response?.data?.error ||
            e?.response?.data?.detail ||
            'Product details could not be identified automatically.',
        );
        setPhase('fail');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, setProductFields, brands]);

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Analyze Product" showBack hideProfile />
      <View style={styles.body}>
        <OnboardingProgress step={1} total={5} />

        {phase === 'loading' && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingTitle}>Analyzing product…</Text>
            <Text style={styles.loadingBody}>
              Please wait a moment while we retrieve the product name, brand, price, and image.
            </Text>
          </View>
        )}

        {phase === 'fail' && (
          <>
            <EmptyState
              icon="search-outline"
              title={
                productName || brandName || currentPrice != null
                  ? 'Additional details required'
                  : 'Product details unavailable'
              }
              body={
                productName || brandName || currentPrice != null
                  ? 'Some information was found. Please complete the remaining fields manually.'
                  : errorMsg ||
                    'This storefront does not expose product data in a readable format. You can enter the details manually.'
              }
              ctaLabel="Enter Details Manually"
              onPressCta={() => navigation.replace('ManualProductScreen')}
            />
            <SecondaryButton label="Try Again" onPress={() => navigation.replace('AnalyzeProductScreen', { url })} />
          </>
        )}

        {phase === 'success' && (
          <>
            <Text style={styles.heading}>Product found</Text>
            <View style={styles.preview}>
              <ProductImage
                uri={displayImage}
                fallbackUri={brandLogoUri}
                size={160}
                style={styles.image}
                icon={displayImage && !imageUrl ? 'storefront-outline' : 'cube-outline'}
                resizeMode={displayImage && !(previewImage || imageUrl) ? 'contain' : 'cover'}
              />
              <Text style={styles.name}>{productName}</Text>
              <Text style={styles.brand}>{brandName}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>
                  {formatSalePrice(currentPrice) || '—'}
                </Text>
                {formatSalePrice(originalPrice) ? (
                  <Text style={styles.was}>Was {formatSalePrice(originalPrice)}</Text>
                ) : null}
                {alreadyOnSale ||
                (currentPrice != null &&
                  originalPrice != null &&
                  Number(originalPrice) > Number(currentPrice)) ? (
                  <View style={styles.discountPill}>
                    <Text style={styles.discountText}>
                      {Math.round(
                        discountPct != null
                          ? Number(discountPct)
                          : (1 - Number(currentPrice) / Number(originalPrice)) * 100,
                      )}
                      % off
                    </Text>
                  </View>
                ) : null}
              </View>
              {alreadyOnSale ? (
                <View style={styles.saleBanner}>
                  <Text style={styles.saleBannerTitle}>
                    Current discount
                    {discountPct != null ? `: ${Math.round(Number(discountPct))}%` : ''}
                  </Text>
                  <Text style={styles.saleBannerBody}>
                    This item is already discounted. On the next steps, set a higher threshold or choose
                    whether to notify now or wait for a further price drop.
                  </Text>
                </View>
              ) : null}
              <Text style={styles.url} numberOfLines={2}>
                {productUrl}
              </Text>
            </View>
            <PrimaryButton label="Confirm Product" onPress={() => navigation.navigate('AlertConditionsScreen')} />
            <SecondaryButton label="Edit Details" onPress={() => navigation.navigate('ManualProductScreen')} />
          </>
        )}
      </View>
    </Screen>
  );
};

export default AnalyzeProductScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    body: { padding: SPACING.four, gap: SPACING.three, flex: 1 },
    loadingBox: { alignItems: 'center', gap: SPACING.two, marginTop: SPACING.six },
    loadingTitle: { ...TYPOGRAPHY.subtitle, color: colors.text },
    loadingBody: { ...TYPOGRAPHY.small, color: colors.textSecondary, textAlign: 'center' },
    heading: { ...TYPOGRAPHY.headline, color: colors.text, marginTop: SPACING.two },
    preview: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.three,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...SHADOWS.card,
      gap: SPACING.two,
      alignItems: 'center',
    },
    image: { width: 160, height: 160, borderRadius: 18 },
    name: { ...TYPOGRAPHY.subtitle, color: colors.text, textAlign: 'center' },
    brand: { ...TYPOGRAPHY.small, color: colors.textSecondary },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    price: { ...TYPOGRAPHY.subtitle, color: colors.text },
    was: { ...TYPOGRAPHY.small, color: colors.textSecondary, textDecorationLine: 'line-through' },
    discountPill: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: RADIUS.chip,
    },
    discountText: { ...TYPOGRAPHY.label, fontSize: 11, color: colors.primary },
    saleBanner: {
      width: '100%',
      backgroundColor: colors.primarySoft,
      borderRadius: RADIUS.card,
      padding: SPACING.three,
      gap: 4,
    },
    saleBannerTitle: { ...TYPOGRAPHY.smallBold, color: colors.primary },
    saleBannerBody: { ...TYPOGRAPHY.small, color: colors.textSecondary, lineHeight: 18 },
    url: { ...TYPOGRAPHY.small, fontSize: 12, color: colors.mutedInk, textAlign: 'center' },
  });
