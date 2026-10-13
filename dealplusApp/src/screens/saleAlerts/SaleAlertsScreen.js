import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Ionicons';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import PrimaryButton from '../../components/PrimaryButton';
import EmptyState from '../../components/EmptyState';
import FilterChip from '../../components/FilterChip';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import useSaleAlertsStore from '../../state/saleAlertsStore';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';
import { conditionLabel, notifyLabel } from '../../services/saleAlertsApi';
import { showErrorToast, showSuccessToast } from '../../utils/CustomToast';

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'product', label: 'Products' },
  { id: 'brand', label: 'Brands' },
  { id: 'triggered', label: 'Triggered' },
];

const statusTone = (status, colors) => {
  if (status === 'active') return { bg: colors.successBg, fg: colors.success, label: 'Active' };
  if (status === 'paused') return { bg: colors.warningBg, fg: colors.warning, label: 'Paused' };
  if (status === 'triggered') return { bg: colors.primarySoft, fg: colors.primary, label: 'Triggered' };
  return { bg: colors.backgroundElement, fg: colors.textSecondary, label: status };
};

const formatPrice = (n) => (n == null || Number.isNaN(Number(n)) ? null : `$${Number(n).toFixed(0)}`);

const SaleAlertsScreen = () => {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { alerts, summary, loading, error, loadAlerts, patchAlert, removeAlert } = useSaleAlertsStore();
  const resetDraft = useCreateAlertDraftStore((s) => s.reset);
  const [tab, setTab] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadAlerts();
    }, [loadAlerts]),
  );

  useEffect(() => {
    loadAlerts();
  }, [loadAlerts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    if (tab === 'all') return alerts;
    if (tab === 'triggered') return alerts.filter((a) => a.status === 'triggered');
    return alerts.filter((a) => a.alert_type === tab);
  }, [alerts, tab]);

  const startCreate = () => {
    resetDraft();
    navigation.navigate('CreateAlertTypeScreen');
  };

  const togglePause = async (alert) => {
    try {
      const next = alert.status === 'active' ? 'paused' : 'active';
      await patchAlert(alert.id, { status: next });
      showSuccessToast(next === 'active' ? 'Alert resumed' : 'Alert paused');
    } catch (e) {
      showErrorToast(e?.message ?? 'Could not update alert');
    }
  };

  const onDelete = async (alert) => {
    try {
      await removeAlert(alert.id);
      showSuccessToast('Alert deleted');
    } catch (e) {
      showErrorToast(e?.message ?? 'Could not delete alert');
    }
  };

  return (
    <Screen style={styles.root}>
      <TopAppBar
        title="Sale Alerts"
        titleAlign="left"
        hideProfile
        rightSlot={
          <Pressable onPress={startCreate} style={styles.createBtn} hitSlop={6}>
            <Icon name="add" size={18} color={colors.onPrimary} />
            <Text style={styles.createBtnText}>Create</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>Get notified when your favorite products or brands go on sale.</Text>

        <View style={styles.statsRow}>
          {[
            { label: 'Active', value: summary.active },
            { label: 'Products', value: summary.products },
            { label: 'Brands', value: summary.brands },
            { label: 'Triggered', value: summary.triggered },
          ].map((s) => (
            <View key={s.label} style={styles.statCard}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => (
            <FilterChip key={t.id} label={t.label} selected={tab === t.id} onPress={() => setTab(t.id)} />
          ))}
        </ScrollView>

        {loading && alerts.length === 0 ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: SPACING.five }} />
        ) : error && alerts.length === 0 ? (
          <EmptyState
            variant="error"
            icon="cloud-offline-outline"
            title="Something went wrong"
            body="Check your connection and try again."
            ctaLabel="Try again"
            onPressCta={loadAlerts}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="notifications-outline"
            title={tab === 'triggered' ? 'No sale alerts yet' : "You aren't tracking anything yet"}
            body={
              tab === 'triggered'
                ? "We'll show your detected deals here."
                : "Add a product or brand and we'll notify you when a sale matches your criteria."
            }
            ctaLabel={tab === 'triggered' ? undefined : '+ Create Alert'}
            onPressCta={tab === 'triggered' ? undefined : startCreate}
          />
        ) : (
          filtered.map((alert) => {
            const tone = statusTone(alert.status, colors);
            const title = alert.alert_type === 'brand' ? alert.brand_name : alert.product_name;
            return (
              <Pressable
                key={alert.id}
                style={styles.card}
                onPress={() => navigation.navigate('AlertDetailScreen', { alertId: alert.id })}>
                <View style={styles.cardTop}>
                  {alert.image_url ? (
                    <Image source={{ uri: alert.image_url }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.thumbPlaceholder]}>
                      <Icon name={alert.alert_type === 'brand' ? 'storefront' : 'cube-outline'} size={22} color={colors.primary} />
                    </View>
                  )}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {title || 'Untitled alert'}
                    </Text>
                    {alert.alert_type === 'product' && !!alert.brand_name && (
                      <Text style={styles.cardMeta}>{alert.brand_name}</Text>
                    )}
                    {alert.alert_type === 'product' && formatPrice(alert.current_price) && (
                      <Text style={styles.cardPrice}>Current: {formatPrice(alert.current_price)}</Text>
                    )}
                    <Text style={styles.cardCondition}>{conditionLabel(alert)}</Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                        <Text style={[styles.badgeText, { color: tone.fg }]}>{tone.label}</Text>
                      </View>
                      <Text style={styles.notifyText}>{notifyLabel(alert)}</Text>
                    </View>
                    {alert.last_checked_at ? (
                      <Text style={styles.checkedText}>
                        Last checked {new Date(alert.last_checked_at).toLocaleString()}
                      </Text>
                    ) : null}
                    {alert.status === 'triggered' && alert.triggered_message ? (
                      <Text style={styles.triggeredMsg} numberOfLines={2}>
                        {alert.triggered_message}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.actions}>
                  <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('AlertDetailScreen', { alertId: alert.id })}>
                    <Text style={styles.actionText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.actionBtn} onPress={() => togglePause(alert)}>
                    <Text style={styles.actionText}>
                      {alert.status === 'active' ? 'Pause' : 'Resume'}
                    </Text>
                  </Pressable>
                  {alert.status === 'triggered' && alert.triggered_deal_url ? (
                    <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(alert.triggered_deal_url)}>
                      <Text style={[styles.actionText, { color: colors.primary }]}>View Deal</Text>
                    </Pressable>
                  ) : (
                    <Pressable style={styles.actionBtn} onPress={() => onDelete(alert)}>
                      <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          })
        )}

        {alerts.length > 0 && (
          <PrimaryButton label="+ Create Alert" onPress={startCreate} style={{ marginTop: SPACING.three }} />
        )}
      </ScrollView>
    </Screen>
  );
};

export default SaleAlertsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    content: { paddingHorizontal: SPACING.four, paddingBottom: SPACING.six, gap: SPACING.three },
    subtitle: { ...TYPOGRAPHY.small, color: colors.textSecondary, marginBottom: SPACING.one },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.two + 4,
      paddingVertical: SPACING.two,
      borderRadius: RADIUS.chip,
    },
    createBtnText: { ...TYPOGRAPHY.label, color: colors.onPrimary, fontSize: 13 },
    statsRow: { flexDirection: 'row', gap: SPACING.two },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      paddingVertical: SPACING.three,
      paddingHorizontal: SPACING.two,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...SHADOWS.card,
    },
    statValue: { ...TYPOGRAPHY.subtitle, color: colors.text },
    statLabel: { ...TYPOGRAPHY.small, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    tabs: { gap: SPACING.two, paddingVertical: SPACING.one },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.three,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...SHADOWS.card,
      gap: SPACING.two,
    },
    cardTop: { flexDirection: 'row', gap: SPACING.three },
    thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.backgroundElement },
    thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    cardBody: { flex: 1, gap: 2 },
    cardTitle: { ...TYPOGRAPHY.smallBold, color: colors.text },
    cardMeta: { ...TYPOGRAPHY.small, fontSize: 13, color: colors.textSecondary },
    cardPrice: { ...TYPOGRAPHY.smallBold, color: colors.text, marginTop: 2 },
    cardCondition: { ...TYPOGRAPHY.small, fontSize: 13, color: colors.primary, marginTop: 2 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.two, marginTop: 4 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.chip },
    badgeText: { ...TYPOGRAPHY.label, fontSize: 11 },
    notifyText: { ...TYPOGRAPHY.small, fontSize: 12, color: colors.textSecondary },
    checkedText: { ...TYPOGRAPHY.small, fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    triggeredMsg: { ...TYPOGRAPHY.small, color: colors.text, marginTop: 4 },
    actions: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: SPACING.two,
      gap: SPACING.three,
    },
    actionBtn: { paddingVertical: 4 },
    actionText: { ...TYPOGRAPHY.label, color: colors.text, fontSize: 13 },
  });
