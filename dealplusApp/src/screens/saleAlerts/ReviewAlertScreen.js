import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import OnboardingProgress from '../../components/OnboardingProgress';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';
import useSaleAlertsStore from '../../state/saleAlertsStore';
import { conditionLabel, notifyLabel } from '../../services/saleAlertsApi';
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
  const resetDraft = useCreateAlertDraftStore((s) => s.reset);
  const addAlert = useSaleAlertsStore((s) => s.addAlert);
  const patchAlert = useSaleAlertsStore((s) => s.patchAlert);
  const [saving, setSaving] = useState(false);
  const isEditing = !!draft.editingAlertId;

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
    notify_push: draft.notifyPush,
    notify_email: draft.notifyEmail,
    notify_in_app: draft.notifyInApp,
  };

  const onCreate = async () => {
    setSaving(true);
    try {
      if (isEditing) {
        await patchAlert(draft.editingAlertId, payload);
        resetDraft();
        navigation.reset({
          index: 1,
          routes: [{ name: 'MainTabs' }, { name: 'SaleAlertsScreen' }],
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
      <View style={styles.body}>
        <OnboardingProgress step={4} total={5} />
        <Text style={styles.heading}>{isEditing ? 'Review Changes' : 'Review Your Alert'}</Text>
        <View style={styles.card}>
          {draft.alertType === 'product' ? (
            <>
              <Row styles={styles} label="Product" value={draft.productName || '—'} />
              <Row styles={styles} label="Brand" value={draft.brandName || '—'} />
              <Row
                styles={styles}
                label="Current Price"
                value={draft.currentPrice != null ? `$${Number(draft.currentPrice).toFixed(0)}` : '—'}
              />
            </>
          ) : (
            <Row styles={styles} label="Brand" value={draft.brandName || '—'} />
          )}
          <Row styles={styles} label="Alert condition" value={conditionLabel(preview)} />
          <Row styles={styles} label="Notifications" value={notifyLabel(preview)} />
          <Row styles={styles} label="Status" value="Active" />
        </View>
        <PrimaryButton
          label={saving ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save Changes' : 'Create Alert'}
          onPress={onCreate}
          disabled={saving}
        />
        <SecondaryButton label="Back" onPress={() => navigation.goBack()} />
      </View>
    </Screen>
  );
};

export default ReviewAlertScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    body: { padding: SPACING.four, gap: SPACING.three },
    heading: { ...TYPOGRAPHY.headline, color: colors.text, marginTop: SPACING.two },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.three,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...SHADOWS.card,
      gap: SPACING.two,
    },
    row: { gap: 2 },
    rowLabel: { ...TYPOGRAPHY.small, color: colors.textSecondary },
    rowValue: { ...TYPOGRAPHY.smallBold, color: colors.text },
  });
