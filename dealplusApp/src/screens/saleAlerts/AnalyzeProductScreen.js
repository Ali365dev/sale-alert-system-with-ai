import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import EmptyState from '../../components/EmptyState';
import OnboardingProgress from '../../components/OnboardingProgress';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';
import { analyzeProductUrl } from '../../services/saleAlertsApi';

const AnalyzeProductScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const url = route.params?.url;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const setProductFields = useCreateAlertDraftStore((s) => s.setProductFields);
  const draft = useCreateAlertDraftStore();
  const [phase, setPhase] = useState('loading'); // loading | success | fail
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await analyzeProductUrl(url);
        if (cancelled) return;
        if (!result?.ok && !result?.product_name && !result?.brand_name) {
          setProductFields({
            productUrl: url,
            analyzeFailed: true,
            analyzePartial: false,
          });
          setErrorMsg(result?.error || "We couldn't automatically identify this product.");
          setPhase('fail');
          return;
        }
        setProductFields({
          productUrl: result.product_url || url,
          productName: result.product_name || '',
          brandName: result.brand_name || '',
          currentPrice: result.current_price ?? null,
          originalPrice: result.original_price ?? null,
          imageUrl: result.image_url || '',
          analyzeFailed: false,
          analyzePartial: !!result.partial,
        });
        if (result.product_name && result.brand_name) setPhase('success');
        else {
          setErrorMsg(result?.error || 'Some details are missing — you can fill them in.');
          setPhase('fail');
        }
      } catch (e) {
        if (cancelled) return;
        setProductFields({ productUrl: url, analyzeFailed: true });
        setErrorMsg(e?.message || e?.response?.data?.error || e?.response?.data?.detail || "We couldn't automatically identify this product.");
        setPhase('fail');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, setProductFields]);

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Analyze Product" showBack hideProfile />
      <View style={styles.body}>
        <OnboardingProgress step={1} total={5} />

        {phase === 'loading' && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingTitle}>Analyzing product...</Text>
            <Text style={styles.loadingBody}>Looking up name, brand, price, and image.</Text>
          </View>
        )}

        {phase === 'fail' && (
          <>
            <EmptyState
              icon="search-outline"
              title={
                draft.productName || draft.brandName || draft.currentPrice != null
                  ? 'Some details are missing'
                  : "We couldn't automatically identify this product"
              }
              body={
                draft.productName || draft.brandName || draft.currentPrice != null
                  ? 'We found some information — fill in the rest manually.'
                  : errorMsg ||
                    "Some websites don't provide product information in a format we can read. You can add the details manually."
              }
              ctaLabel="Add Product Manually"
              onPressCta={() => navigation.replace('ManualProductScreen')}
            />
            <SecondaryButton label="Try Again" onPress={() => navigation.replace('AnalyzeProductScreen', { url })} />
          </>
        )}

        {phase === 'success' && (
          <>
            <Text style={styles.heading}>Product found</Text>
            <View style={styles.preview}>
              {draft.imageUrl ? (
                <Image source={{ uri: draft.imageUrl }} style={styles.image} />
              ) : (
                <View style={[styles.image, styles.imagePh]} />
              )}
              <Text style={styles.name}>{draft.productName}</Text>
              <Text style={styles.brand}>{draft.brandName}</Text>
              <Text style={styles.price}>
                {draft.currentPrice != null ? `$${Number(draft.currentPrice).toFixed(0)}` : '—'}
                {draft.originalPrice != null ? (
                  <Text style={styles.was}>  Was ${Number(draft.originalPrice).toFixed(0)}</Text>
                ) : null}
              </Text>
              <Text style={styles.url} numberOfLines={2}>
                {draft.productUrl}
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
    image: { width: 120, height: 120, borderRadius: 16, backgroundColor: colors.backgroundElement },
    imagePh: {},
    name: { ...TYPOGRAPHY.subtitle, color: colors.text, textAlign: 'center' },
    brand: { ...TYPOGRAPHY.small, color: colors.textSecondary },
    price: { ...TYPOGRAPHY.subtitle, color: colors.text },
    was: { ...TYPOGRAPHY.small, color: colors.textSecondary, textDecorationLine: 'line-through' },
    url: { ...TYPOGRAPHY.small, fontSize: 12, color: colors.mutedInk, textAlign: 'center' },
  });
