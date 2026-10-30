import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import OnboardingProgress from '../../components/OnboardingProgress';
import ProductImage from '../../components/ProductImage';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';
import useSaleAlertsStore from '../../state/saleAlertsStore';
import useDataStore from '../../state/dataStore';
import { conditionLabel, notifyLabel } from '../../services/saleAlertsApi';
import { validateAlertDraft } from '../../utils/saleAlertValidation';
import { formatSalePrice } from '../../utils/formatSalePrice';
import { resolveSaleAlertImageSources } from '../../utils/saleAlertImage';
import { showErrorToast } from '../../utils/CustomToast';

const Row = ({ label, value, styles }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value}</Text>
  </View>
);

const ReviewAlertScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const draft = useCreateAlertDraftStore();
  const setField = useCreateAlertDraftStore((s) => s.setField);
  const resetDraft = useCreateAlertDraftStore((s) => s.reset);
  const addAlert = useSaleAlertsStore((s) => s.addAlert);
  const patchAlert = useSaleAlertsStore((s) => s.patchAlert);
  const brands = useDataStore((s) => s.brands);
  const { uri: previewImage, fallbackUri: brandLogoUri } = resolveSaleAlertImageSources(
    { imageUrl: draft.imageUrl, brandName: draft.brandName },
    brands,
  );
  const [saving, setSaving] = useState(false);
  const isEditing = !!draft.editingAlertId;
  const showAlreadyOnSale =
    !isEditing && draft.alertType === 'product' && !!draft.alreadyOnSale && draft.currentPrice != null;
  const waitForDrop = draft.alreadyOnSaleChoice === 'watch_for_drop';

  const preview = {
    condition_type: draft.conditionType,
    custom_pct: draft.customPct,
    target_price: draft.targetPrice,
    notify_push: draft.notifyPush,
    notify_email: draft.notifyEmail,
    notify_in_app: draft.notifyInApp,
  };

  const payload = {
    alert_type: draft.alertType,
    status: 'active',
    product_name: draft.productName || null,
    brand_name: draft.brandName || null,
    product_url: draft.productUrl || null,
    image_url: draft.imageUrl || null,
    current_price: draft.currentPrice,
    original_price: draft.originalPrice,
    sku: draft.sku || null,
    variant: draft.variant || null,
    condition_type: draft.conditionType,
    custom_pct: draft.conditionType === 'custom_pct' ? draft.customPct : null,
    target_price: draft.conditionType === 'target_price' ? draft.targetPrice : null,
    watch_below_price: showAlreadyOnSale && waitForDrop ? draft.currentPrice : null,
    notify_push: draft.notifyPush,
    notify_email: draft.notifyEmail,
    notify_in_app: draft.notifyInApp,
  };

  const onCreate = async () => {
    const validation = validateAlertDraft(draft);
    if (!validation.ok) {
      const blocksCreate =
        /threshold above|already \d+% off|lower target|current price is/i.test(validation.error || '');
      if (blocksCreate) {
        Alert.alert('Unable to create alert', validation.error, [{ text: 'OK' }]);
      }
      showErrorToast(validation.error);
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await patchAlert(draft.editingAlertId, payload);
        resetDraft();
        navigation.reset({
          index: 0,
          routes: [{ name: 'MainTabs', params: { screen: 'Track' } }],
        });
      } else {
        await addAlert(payload);
        navigation.replace('AlertCreatedScreen');
      }
    } catch (e) {
      showErrorToast(e?.response?.data?.error || e?.message || (isEditing ? 'Could not update alert' : 'Could not create alert'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Review" showBack hideProfile />
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <OnboardingProgress step={4} total={5} />
        <Text style={styles.heading}>{isEditing ? 'Review Changes' : 'Review Your Alert'}</Text>
        <View style={styles.card}>
          {(previewImage || draft.alertType === 'product') && (
            <View style={styles.previewRow}>
              <ProductImage
                uri={previewImage}
                fallbackUri={brandLogoUri}
                size={64}
                icon={
                  draft.alertType === 'brand' || (!previewImage && brandLogoUri)
                    ? 'storefront-outline'
                    : 'cube-outline'
                }
                resizeMode={draft.alertType === 'brand' ? 'contain' : 'cover'}
              />
              <View style={styles.previewText}>
                <Text style={styles.previewTitle} numberOfLines={2}>
                  {draft.alertType === 'brand' ? draft.brandName : draft.productName}
                </Text>
                {draft.alertType === 'product' && !!draft.brandName ? (
                  <Text style={styles.previewBrand}>{draft.brandName}</Text>
                ) : null}
              </View>
            </View>
          )}
          {draft.alertType === 'product' ? (
            <>
              <Row styles={styles} label="Product" value={draft.productName || '—'} />
              <Row styles={styles} label="Brand" value={draft.brandName || '—'} />
              <Row
                styles={styles}
                label="Current Price"
                value={formatSalePrice(draft.currentPrice) || '—'}
              />
            </>
          ) : (
            <Row styles={styles} label="Brand" value={draft.brandName || '—'} />
          )}
          <Row styles={styles} label="Alert condition" value={conditionLabel(preview)} />
          <Row styles={styles} label="Notifications" value={notifyLabel(preview)} />
          <Row
            styles={styles}
            label="Status"
            value={showAlreadyOnSale && waitForDrop ? 'Monitoring for a further drop' : 'Active'}
          />
        </View>

        {showAlreadyOnSale ? (
          <View style={styles.choiceCard}>
            <Text style={styles.choiceTitle}>
              Current discount
              {draft.discountPct != null ? `: ${Math.round(Number(draft.discountPct))}%` : ''}
            </Text>
            <Text style={styles.choiceSub}>
              {draft.discountPct != null
                ? `This product is currently ${Math.round(Number(draft.discountPct))}% off.`
                : 'This product is currently discounted.'}{' '}
              Choose how you would like to be notified.
            </Text>
            <Pressable
              style={[styles.choiceOption, !waitForDrop && styles.choiceOptionSelected]}
              onPress={() => setField('alreadyOnSaleChoice', 'notify_now')}>
              <Text style={[styles.choiceOptionTitle, !waitForDrop && styles.choiceOptionTitleSelected]}>
                Notify if condition is met
              </Text>
              <Text style={styles.choiceOptionBody}>
                Send an alert if the current offer already matches your selected condition.
              </Text>
            </Pressable>
            <Pressable
              style={[styles.choiceOption, waitForDrop && styles.choiceOptionSelected]}
              onPress={() => setField('alreadyOnSaleChoice', 'watch_for_drop')}>
              <Text style={[styles.choiceOptionTitle, waitForDrop && styles.choiceOptionTitleSelected]}>
                Wait for a lower price
              </Text>
              <Text style={styles.choiceOptionBody}>
                Notify only when the price falls below{' '}
                {formatSalePrice(draft.currentPrice) || 'the current price'}.
              </Text>
            </Pressable>
          </View>
        ) : null}

        <PrimaryButton
          label={saving ? (isEditing ? 'Saving…' : 'Starting…') : isEditing ? 'Save Changes' : 'Start Tracking'}
          onPress={onCreate}
          disabled={saving}
        />
        <SecondaryButton label="Back" onPress={() => navigation.goBack()} />
      </ScrollView>
    </Screen>
  );
};

export default ReviewAlertScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    body: { padding: SPACING.four, paddingBottom: SPACING.six, gap: SPACING.three },
    heading: { ...TYPOGRAPHY.headline, color: colors.text, marginTop: SPACING.two },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.three,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...SHADOWS.card,
      gap: SPACING.three,
    },
    previewRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.three },
    previewText: { flex: 1, gap: 2 },
    previewTitle: { ...TYPOGRAPHY.smallBold, color: colors.text },
    previewBrand: { ...TYPOGRAPHY.small, color: colors.textSecondary },
    row: { gap: 2 },
    rowLabel: { ...TYPOGRAPHY.small, color: colors.textSecondary },
    rowValue: { ...TYPOGRAPHY.smallBold, color: colors.text },
    choiceCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.three,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      gap: SPACING.two,
    },
    choiceTitle: { ...TYPOGRAPHY.smallBold, color: colors.primary },
    choiceSub: { ...TYPOGRAPHY.small, color: colors.textSecondary, lineHeight: 18, marginBottom: SPACING.one },
    choiceOption: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: RADIUS.card,
      padding: SPACING.three,
      gap: 4,
    },
    choiceOptionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    choiceOptionTitle: { ...TYPOGRAPHY.smallBold, color: colors.text },
    choiceOptionTitleSelected: { color: colors.primary },
    choiceOptionBody: { ...TYPOGRAPHY.small, color: colors.textSecondary, lineHeight: 18 },
  });
