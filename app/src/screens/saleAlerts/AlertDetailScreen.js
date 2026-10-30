import { useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import ProductImage from '../../components/ProductImage';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useSaleAlertsStore from '../../state/saleAlertsStore';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';
import useDataStore from '../../state/dataStore';
import { checkSaleAlert, conditionLabel, notifyLabel } from '../../services/saleAlertsApi';
import { formatSalePrice } from '../../utils/formatSalePrice';
import { resolveSaleAlertImageSources } from '../../utils/saleAlertImage';
import { validateProductUrl } from '../../utils/saleAlertValidation';
import { formatRelativeTime } from '../../utils/dealAdapters';
import { showErrorToast, showSuccessToast } from '../../utils/CustomToast';

const Row = ({ label, value, styles }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value || '—'}</Text>
  </View>
);

const statusLabel = (status) => {
  if (status === 'active') return 'Active';
  if (status === 'paused') return 'Paused';
  if (status === 'triggered') return 'Triggered';
  if (status === 'needs_attention') return 'Link update required';
  return status;
};

const AlertDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const alertId = route.params?.alertId;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const alerts = useSaleAlertsStore((s) => s.alerts);
  const patchAlert = useSaleAlertsStore((s) => s.patchAlert);
  const removeAlert = useSaleAlertsStore((s) => s.removeAlert);
  const loadAlerts = useSaleAlertsStore((s) => s.loadAlerts);
  const loadFromAlert = useCreateAlertDraftStore((s) => s.loadFromAlert);
  const brands = useDataStore((s) => s.brands);
  const [checking, setChecking] = useState(false);
  const [savingUrl, setSavingUrl] = useState(false);
  const [urlDraft, setUrlDraft] = useState(null);
  const alert = alerts.find((a) => a.id === alertId);

  if (!alert) {
    return (
      <Screen>
        <TopAppBar title="Alert Details" showBack hideProfile />
        <Text style={{ padding: SPACING.four, color: colors.textSecondary }}>Alert not found.</Text>
      </Screen>
    );
  }

  const title = alert.alert_type === 'brand' ? alert.brand_name : alert.product_name;
  const needsAttention = alert.status === 'needs_attention';
  const isOn = alert.status === 'active' || alert.status === 'triggered';
  const editingUrl = urlDraft != null;
  const urlValue = editingUrl ? urlDraft : alert.product_url || '';
  const { uri: imageUri, fallbackUri: brandLogoUri } = resolveSaleAlertImageSources(alert, brands);
  const usingBrandLogo = !imageUri && !!brandLogoUri;

  const onPause = async () => {
    if (needsAttention) {
      showErrorToast('Please update the product link before resuming this alert.');
      return;
    }
    try {
      const next = alert.status === 'active' ? 'paused' : 'active';
      await patchAlert(alert.id, { status: next });
      showSuccessToast(next === 'active' ? 'Alert resumed' : 'Alert paused');
    } catch (e) {
      showErrorToast(e?.message ?? 'Update failed');
    }
  };

  const onDelete = () => {
    Alert.alert('Delete Alert', 'Remove this alert permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeAlert(alert.id);
            showSuccessToast('Alert deleted');
            navigation.goBack();
          } catch (e) {
            showErrorToast(e?.message ?? 'Delete failed');
          }
        },
      },
    ]);
  };

  const onCheckNow = async () => {
    setChecking(true);
    try {
      const data = await checkSaleAlert(alert.id);
      await loadAlerts();
      if (data?.result?.triggered) {
        showSuccessToast('Your sale condition was met. Alert triggered.');
      } else if (data?.result?.ok) {
        showSuccessToast('Check complete. No matching sale yet.');
      } else if (data?.result?.status === 'needs_attention') {
        showErrorToast('This product link is still unavailable. Please update the URL.');
      } else {
        showErrorToast(data?.result?.error || 'Unable to check this alert right now.');
      }
    } catch (e) {
      showErrorToast(e?.response?.data?.error || e?.message || 'Unable to check this alert right now.');
    } finally {
      setChecking(false);
    }
  };

  const onSaveUrl = async () => {
    const result = validateProductUrl(urlValue);
    if (!result.ok) {
      showErrorToast(result.error);
      return;
    }
    setSavingUrl(true);
    try {
      await patchAlert(alert.id, { product_url: result.value, status: 'active' });
      setUrlDraft(null);
      showSuccessToast('Product link updated. Rechecking…');
      await loadAlerts();
      try {
        await checkSaleAlert(alert.id);
        await loadAlerts();
      } catch {
        // Background recheck is best-effort; list refresh already happened.
      }
    } catch (e) {
      showErrorToast(e?.response?.data?.error || e?.message || 'Unable to update the product URL.');
    } finally {
      setSavingUrl(false);
    }
  };

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Alert Details" showBack hideProfile />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <ProductImage
            uri={imageUri}
            fallbackUri={brandLogoUri}
            size={140}
            icon={
              alert.alert_type === 'brand' || usingBrandLogo ? 'storefront-outline' : 'cube-outline'
            }
            resizeMode={usingBrandLogo || alert.alert_type === 'brand' ? 'contain' : 'cover'}
          />
          <Text style={styles.title}>{title}</Text>
          {alert.alert_type === 'product' && !!alert.brand_name ? (
            <Text style={styles.brand}>{alert.brand_name}</Text>
          ) : null}
        </View>

        {needsAttention ? (
          <View style={styles.attentionBanner}>
            <Icon name="warning-outline" size={18} color={colors.warning || colors.primary} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.attentionTitle}>Product link unavailable</Text>
              <Text style={styles.attentionBody}>
                {alert.last_check_error ||
                  alert.triggered_message ||
                  'This product page could not be reached. Please update the URL to continue monitoring.'}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.statusCard}>
          <View>
            <Text style={styles.statusLabel}>Alert status</Text>
            <Text style={styles.statusValue}>{statusLabel(alert.status)}</Text>
          </View>
          <Switch
            value={isOn && alert.status !== 'paused'}
            onValueChange={onPause}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.white}
            disabled={needsAttention}
          />
        </View>

        <View style={styles.card}>
          <Row styles={styles} label="Type" value={alert.alert_type === 'brand' ? 'Brand alert' : 'Product alert'} />
          {alert.alert_type === 'product' && (
            <>
              <Row
                styles={styles}
                label="Current price"
                value={formatSalePrice(alert.current_price)}
              />
              <Row
                styles={styles}
                label="Original price"
                value={formatSalePrice(alert.original_price)}
              />
              {alert.watch_below_price != null ? (
                <Row
                  styles={styles}
                  label="Watch below"
                  value={formatSalePrice(alert.watch_below_price)}
                />
              ) : null}
            </>
          )}
          <Row styles={styles} label="Condition" value={conditionLabel(alert)} />
          <Row styles={styles} label="Notifications" value={notifyLabel(alert)} />
          <Row
            styles={styles}
            label="Last checked"
            value={alert.last_checked_at ? formatRelativeTime(alert.last_checked_at) : 'Not yet'}
          />
          <Row
            styles={styles}
            label="Last detected sale"
            value={alert.last_triggered_at ? formatRelativeTime(alert.last_triggered_at) : 'None yet'}
          />
          {alert.triggered_message && !needsAttention ? (
            <Row styles={styles} label="Trigger" value={alert.triggered_message} />
          ) : null}
        </View>

        {alert.alert_type === 'product' ? (
          <View style={styles.card}>
            <Text style={styles.rowLabel}>Product URL</Text>
            {editingUrl || needsAttention ? (
              <>
                <TextInput
                  style={styles.urlInput}
                  value={urlValue}
                  onChangeText={(t) => setUrlDraft(t)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  placeholder="https://shop.com/products/..."
                  placeholderTextColor={colors.mutedInk}
                />
                <View style={styles.urlActions}>
                  <PrimaryButton
                    label={savingUrl ? 'Saving…' : 'Save & Recheck'}
                    onPress={onSaveUrl}
                    disabled={savingUrl}
                  />
                  {!needsAttention ? (
                    <Pressable onPress={() => setUrlDraft(null)} style={styles.cancelUrl}>
                      <Text style={styles.cancelUrlText}>Cancel</Text>
                    </Pressable>
                  ) : null}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.rowValue}>{alert.product_url || '—'}</Text>
                <Pressable style={styles.linkAction} onPress={() => setUrlDraft(alert.product_url || '')}>
                  <Icon name="link-outline" size={18} color={colors.text} />
                  <Text style={styles.linkActionText}>Update product URL</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : null}

        {alert.product_url && !needsAttention ? (
          <PrimaryButton label="View Product" onPress={() => Linking.openURL(alert.product_url)} />
        ) : null}
        {alert.triggered_deal_url && !needsAttention ? (
          <PrimaryButton label="View Deal" onPress={() => Linking.openURL(alert.triggered_deal_url)} />
        ) : null}
        {alert.alert_type === 'product' && alert.product_url ? (
          <Pressable style={styles.linkAction} onPress={checking ? undefined : onCheckNow}>
            <Icon name="refresh-outline" size={18} color={colors.text} />
            <Text style={styles.linkActionText}>{checking ? 'Checking…' : 'Check Price Now'}</Text>
          </Pressable>
        ) : null}

        <View style={styles.actionList}>
          <Pressable
            style={styles.linkAction}
            onPress={() => {
              loadFromAlert(alert);
              if (alert.alert_type === 'product') navigation.navigate('ManualProductScreen');
              else navigation.navigate('AlertConditionsScreen');
            }}>
            <Icon name="create-outline" size={18} color={colors.text} />
            <Text style={styles.linkActionText}>Edit Alert</Text>
          </Pressable>
          <Pressable style={styles.linkAction} onPress={onPause} disabled={needsAttention}>
            <Icon
              name={alert.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
              size={18}
              color={colors.text}
            />
            <Text style={styles.linkActionText}>
              {alert.status === 'paused' || alert.status === 'triggered' ? 'Resume Alert' : 'Pause Alert'}
            </Text>
          </Pressable>
          <Pressable style={styles.linkAction} onPress={onDelete}>
            <Icon name="trash-outline" size={18} color={colors.error} />
            <Text style={[styles.linkActionText, { color: colors.error }]}>Delete Alert</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
};

export default AlertDetailScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    body: { padding: SPACING.four, gap: SPACING.three, paddingBottom: SPACING.six },
    hero: { alignItems: 'center', gap: SPACING.two },
    title: { ...TYPOGRAPHY.headline, color: colors.text, textAlign: 'center' },
    brand: { ...TYPOGRAPHY.small, color: colors.textSecondary },
    attentionBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.two,
      backgroundColor: colors.warningBg || colors.primarySoft,
      borderRadius: RADIUS.card,
      padding: SPACING.three,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.warning || colors.primary,
    },
    attentionTitle: { ...TYPOGRAPHY.smallBold, color: colors.text },
    attentionBody: { ...TYPOGRAPHY.small, color: colors.textSecondary, lineHeight: 18 },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.three,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...SHADOWS.card,
    },
    statusLabel: { ...TYPOGRAPHY.small, color: colors.textSecondary },
    statusValue: { ...TYPOGRAPHY.smallBold, color: colors.text, marginTop: 2 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.three,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...SHADOWS.card,
      gap: SPACING.three,
    },
    row: { gap: 2 },
    rowLabel: { ...TYPOGRAPHY.small, color: colors.textSecondary },
    rowValue: { ...TYPOGRAPHY.smallBold, color: colors.text },
    urlInput: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: RADIUS.card,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.three,
      color: colors.text,
      ...TYPOGRAPHY.small,
    },
    urlActions: { gap: SPACING.two },
    cancelUrl: { alignItems: 'center', paddingVertical: SPACING.two },
    cancelUrlText: { ...TYPOGRAPHY.label, color: colors.textSecondary },
    actionList: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...SHADOWS.card,
      overflow: 'hidden',
    },
    linkAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.three,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    linkActionText: { ...TYPOGRAPHY.default, color: colors.text },
  });
