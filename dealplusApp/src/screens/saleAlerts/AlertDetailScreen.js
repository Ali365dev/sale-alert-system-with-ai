import { useMemo, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import SecondaryButton from '../../components/SecondaryButton';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useSaleAlertsStore from '../../state/saleAlertsStore';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';
import { checkSaleAlert, conditionLabel, notifyLabel } from '../../services/saleAlertsApi';
import { showErrorToast, showSuccessToast } from '../../utils/CustomToast';

const Row = ({ label, value, styles }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={styles.rowValue}>{value || '—'}</Text>
  </View>
);

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
  const [checking, setChecking] = useState(false);
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

  const onPause = async () => {
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
        showSuccessToast('Sale condition matched — alert triggered');
      } else if (data?.result?.ok) {
        showSuccessToast('Checked — no matching sale yet');
      } else {
        showErrorToast(data?.result?.error || 'Check failed');
      }
    } catch (e) {
      showErrorToast(e?.response?.data?.error || e?.message || 'Check failed');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Alert Details" showBack hideProfile />
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.card}>
          <Row styles={styles} label="Type" value={alert.alert_type === 'brand' ? 'Brand alert' : 'Product alert'} />
          {alert.alert_type === 'product' && (
            <>
              <Row styles={styles} label="Brand" value={alert.brand_name} />
              <Row
                styles={styles}
                label="Current price"
                value={alert.current_price != null ? `$${Number(alert.current_price).toFixed(0)}` : null}
              />
            </>
          )}
          <Row styles={styles} label="Condition" value={conditionLabel(alert)} />
          <Row styles={styles} label="Status" value={alert.status} />
          <Row styles={styles} label="Notifications" value={notifyLabel(alert)} />
          <Row
            styles={styles}
            label="Last checked"
            value={alert.last_checked_at ? new Date(alert.last_checked_at).toLocaleString() : 'Not yet'}
          />
          <Row
            styles={styles}
            label="Last detected sale"
            value={alert.last_triggered_at ? new Date(alert.last_triggered_at).toLocaleString() : 'None yet'}
          />
          {alert.triggered_message ? <Row styles={styles} label="Trigger" value={alert.triggered_message} /> : null}
          {alert.product_url ? <Row styles={styles} label="Product URL" value={alert.product_url} /> : null}
        </View>

        {alert.product_url ? (
          <PrimaryButton label="View Product" onPress={() => Linking.openURL(alert.product_url)} />
        ) : null}
        {alert.triggered_deal_url ? (
          <PrimaryButton label="View Deal" onPress={() => Linking.openURL(alert.triggered_deal_url)} />
        ) : null}
        {alert.alert_type === 'product' && alert.product_url ? (
          <SecondaryButton
            label={checking ? 'Checking…' : 'Check Price Now'}
            onPress={checking ? undefined : onCheckNow}
          />
        ) : null}
        <SecondaryButton
          label="Edit Alert"
          onPress={() => {
            loadFromAlert(alert);
            if (alert.alert_type === 'product') navigation.navigate('ManualProductScreen');
            else navigation.navigate('AlertConditionsScreen');
          }}
        />
        <SecondaryButton
          label={alert.status === 'paused' || alert.status === 'triggered' ? 'Resume Alert' : 'Pause Alert'}
          onPress={onPause}
        />
        <SecondaryButton label="Delete Alert" onPress={onDelete} />
      </ScrollView>
    </Screen>
  );
};

export default AlertDetailScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    body: { padding: SPACING.four, gap: SPACING.three, paddingBottom: SPACING.six },
    title: { ...TYPOGRAPHY.headline, color: colors.text },
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
