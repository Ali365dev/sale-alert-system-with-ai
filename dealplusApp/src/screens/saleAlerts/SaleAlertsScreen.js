import { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import Icon from 'react-native-vector-icons/Ionicons';
import Screen from '../../components/Screen';
import TopAppBar from '../../components/TopAppBar';
import EmptyState from '../../components/EmptyState';
import FilterChip from '../../components/FilterChip';
import PaginationLoader from '../../components/PaginationLoader';
import ProductImage from '../../components/ProductImage';
import Skeleton from '../../components/Skeleton';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../../styles/theme';
import useTheme from '../../hooks/useTheme';
import { usePagination } from '../../hooks/usePagination';
import useSaleAlertsStore from '../../state/saleAlertsStore';
import useCreateAlertDraftStore from '../../state/createAlertDraftStore';
import useDataStore from '../../state/dataStore';
import { conditionLabel, notifyLabel } from '../../services/saleAlertsApi';
import { formatRelativeTime } from '../../utils/dealAdapters';
import { showErrorToast, showSuccessToast } from '../../utils/CustomToast';
import { formatSalePrice } from '../../utils/formatSalePrice';
import { resolveSaleAlertImageSources } from '../../utils/saleAlertImage';
import { validateProductUrl } from '../../utils/saleAlertValidation';

const SaleAlertsSkeleton = ({ styles }) => (
  <View style={styles.skeletonWrap}>
    <View style={styles.skeletonTabs}>
      {[72, 90].map((w, i) => (
        <Skeleton key={i} width={w} height={34} radius={999} />
      ))}
    </View>
    <View style={styles.listGap}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.card}>
          <View style={styles.cardMain}>
            <Skeleton width={76} height={76} radius={14} />
            <View style={styles.skeletonCardBody}>
              <Skeleton width="80%" height={16} radius={6} />
              <Skeleton width="45%" height={12} radius={6} />
              <Skeleton width="35%" height={16} radius={6} />
              <Skeleton width="55%" height={12} radius={6} />
            </View>
          </View>
        </View>
      ))}
    </View>
  </View>
);

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'triggered', label: 'Triggered' },
];

const statusTone = (status, colors) => {
  if (status === 'active') return { bg: colors.successBg, fg: colors.success, label: 'Active', dot: colors.success };
  if (status === 'paused') return { bg: colors.backgroundElement, fg: colors.textSecondary, label: 'Paused', dot: colors.mutedInk };
  if (status === 'triggered') return { bg: colors.primarySoft, fg: colors.primary, label: 'Triggered', dot: colors.primary };
  if (status === 'needs_attention') {
    return {
      bg: colors.warningBg || colors.primarySoft,
      fg: colors.warning || colors.primary,
      label: 'Link update required',
      dot: colors.warning || colors.primary,
    };
  }
  return { bg: colors.backgroundElement, fg: colors.textSecondary, label: status, dot: colors.mutedInk };
};

const discountPct = (current, original) => {
  if (current == null || original == null) return null;
  const cur = Number(current);
  const orig = Number(original);
  if (!orig || cur >= orig) return null;
  return Math.round((1 - cur / orig) * 100);
};

const SaleAlertCard = ({ alert, colors, styles, navigation, togglePause, onDelete, brands }) => {
  const tone = statusTone(alert.status, colors);
  const title = alert.product_name;
  const pct = discountPct(alert.current_price, alert.original_price);
  const triggered = alert.status === 'triggered';
  const { uri: imageUri, fallbackUri: brandLogoUri } = resolveSaleAlertImageSources(alert, brands);

  return (
    <Pressable
      style={[styles.card, triggered && styles.cardTriggered]}
      onPress={() => navigation.navigate('AlertDetailScreen', { alertId: alert.id })}>
      {triggered && alert.triggered_message ? (
        <View style={styles.triggerBanner}>
          <Icon name="flame" size={16} color={colors.primary} />
          <Text style={styles.triggerBannerText} numberOfLines={2}>
            {alert.triggered_message}
          </Text>
        </View>
      ) : null}

      <View style={styles.cardMain}>
        <ProductImage
          uri={imageUri}
          fallbackUri={brandLogoUri}
          size={76}
          icon={imageUri ? 'cube-outline' : 'storefront-outline'}
          style={styles.thumb}
          resizeMode="cover"
        />

        <View style={styles.cardBody}>
          <View style={styles.titleRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {title || 'Untitled alert'}
            </Text>
            <Switch
              value={alert.status === 'active' || alert.status === 'triggered'}
              onValueChange={() => togglePause(alert)}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor={colors.white}
              style={styles.switch}
              disabled={alert.status === 'needs_attention'}
            />
          </View>

          {!!alert.brand_name ? (
            <Text style={styles.cardMeta} numberOfLines={1}>
              {alert.brand_name}
            </Text>
          ) : null}

          <View style={styles.priceRow}>
            {formatSalePrice(alert.current_price) ? (
              <Text style={styles.cardPrice}>{formatSalePrice(alert.current_price)}</Text>
            ) : null}
            {formatSalePrice(alert.original_price) ? (
              <Text style={styles.wasPrice}>{formatSalePrice(alert.original_price)}</Text>
            ) : null}
            {pct != null ? (
              <View style={styles.discountPill}>
                <Text style={styles.discountText}>{pct}% off</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.cardCondition}>{conditionLabel(alert)}</Text>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: tone.bg }]}>
              <View style={[styles.dot, { backgroundColor: tone.dot }]} />
              <Text style={[styles.badgeText, { color: tone.fg }]}>{tone.label}</Text>
            </View>
            <Text style={styles.notifyText}>{notifyLabel(alert)}</Text>
          </View>

          <Text style={styles.checkedText}>
            {alert.last_checked_at
              ? `Checked ${formatRelativeTime(alert.last_checked_at)}`
              : 'Not checked yet'}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable
          style={styles.actionBtn}
          hitSlop={8}
          onPress={() => navigation.navigate('AlertDetailScreen', { alertId: alert.id })}>
          <Icon name="create-outline" size={16} color={colors.text} />
          <Text style={styles.actionText}>Edit</Text>
        </Pressable>
        <Pressable style={styles.actionBtn} hitSlop={8} onPress={() => togglePause(alert)}>
          <Icon
            name={alert.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
            size={16}
            color={colors.text}
          />
          <Text style={styles.actionText}>{alert.status === 'active' ? 'Pause' : 'Resume'}</Text>
        </Pressable>
        {triggered && (alert.triggered_deal_url || alert.product_url) ? (
          <Pressable
            style={[styles.actionBtn, styles.viewDealBtn]}
            onPress={() => Linking.openURL(alert.triggered_deal_url || alert.product_url)}>
            <Text style={styles.viewDealText}>View Deal</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.actionBtn} hitSlop={8} onPress={() => onDelete(alert)}>
            <Icon name="trash-outline" size={16} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
};

const SaleAlertsScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { alerts, loading, error, loadAlerts, patchAlert, removeAlert } = useSaleAlertsStore();
  const brands = useDataStore((s) => s.brands);
  const resetDraft = useCreateAlertDraftStore((s) => s.reset);
  const setField = useCreateAlertDraftStore((s) => s.setField);
  const [tab, setTab] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [quickUrl, setQuickUrl] = useState('');
  const [urlError, setUrlError] = useState('');

  useFocusEffect(
    useCallback(() => {
      const hasData = useSaleAlertsStore.getState().alerts.length > 0;
      loadAlerts({ silent: hasData });
    }, [loadAlerts]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadAlerts({ silent: true });
    } finally {
      setRefreshing(false);
    }
  };

  const showInitialSkeleton = loading && !refreshing && alerts.length === 0;

  // Brand alerts hidden for now — product-only surface.
  const productAlerts = useMemo(
    () => alerts.filter((a) => a.alert_type === 'product'),
    [alerts],
  );

  const filtered = useMemo(() => {
    if (tab === 'triggered') return productAlerts.filter((a) => a.status === 'triggered');
    return productAlerts;
  }, [productAlerts, tab]);

  const { visibleItems, isLoadingMore, loadMore } = usePagination(filtered, 8);

  const startCreate = () => {
    resetDraft();
    setField('alertType', 'product');
    navigation.navigate('AddProductUrlScreen');
  };

  const continueWithUrl = useCallback(() => {
    const result = validateProductUrl(quickUrl);
    if (!result.ok) {
      setUrlError(result.error);
      showErrorToast(result.error);
      return;
    }
    setUrlError('');
    resetDraft();
    setField('alertType', 'product');
    setField('productUrl', result.value);
    setQuickUrl('');
    navigation.navigate('AnalyzeProductScreen', { url: result.value });
  }, [quickUrl, resetDraft, setField, navigation]);

  const togglePause = useCallback(
    async (alert) => {
      try {
        const next = alert.status === 'active' ? 'paused' : 'active';
        await patchAlert(alert.id, { status: next });
        showSuccessToast(next === 'active' ? 'Alert resumed' : 'Alert paused');
      } catch (e) {
        showErrorToast(e?.message ?? 'Could not update alert');
      }
    },
    [patchAlert],
  );

  const onDelete = useCallback(
    async (alert) => {
      try {
        await removeAlert(alert.id);
        showSuccessToast('Alert deleted');
      } catch (e) {
        showErrorToast(e?.message ?? 'Could not delete alert');
      }
    },
    [removeAlert],
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerBlock}>
        <Text style={styles.subtitle}>
          Track products and receive notifications when they meet your sale conditions.
        </Text>

        <View style={styles.urlCard}>
          <Text style={styles.urlLabel}>Product link</Text>
          <TextInput
            style={[styles.urlInput, urlError ? styles.urlInputError : null]}
            value={quickUrl}
            onChangeText={(t) => {
              setQuickUrl(t);
              if (urlError) setUrlError('');
            }}
            placeholder="https://example.com/product/..."
            placeholderTextColor={colors.mutedInk}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            onSubmitEditing={continueWithUrl}
          />
          {urlError ? <Text style={styles.urlErrorText}>{urlError}</Text> : null}
          <Pressable
            style={[styles.urlContinue, !quickUrl.trim() && styles.urlContinueDisabled]}
            onPress={continueWithUrl}
            disabled={!quickUrl.trim()}
            accessibilityRole="button"
            accessibilityLabel="Continue with product URL">
            <Text style={styles.urlContinueText}>Continue</Text>
            <Icon name="arrow-forward" size={16} color={colors.onPrimary} />
          </Pressable>
        </View>

        {showInitialSkeleton ? (
          <SaleAlertsSkeleton styles={styles} />
        ) : error && productAlerts.length === 0 ? (
          <EmptyState
            variant="error"
            icon="cloud-offline-outline"
            title="Unable to load alerts"
            body="Please check your connection and try again."
            ctaLabel="Try Again"
            onPressCta={() => loadAlerts()}
          />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabs}
            style={styles.tabsWrap}>
            {TABS.map((t) => (
              <FilterChip key={t.id} label={t.label} selected={tab === t.id} onPress={() => setTab(t.id)} />
            ))}
          </ScrollView>
        )}
      </View>
    ),
    [
      showInitialSkeleton,
      error,
      productAlerts.length,
      tab,
      styles,
      colors,
      loadAlerts,
      quickUrl,
      urlError,
      continueWithUrl,
    ],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <SaleAlertCard
        alert={item}
        colors={colors}
        styles={styles}
        navigation={navigation}
        togglePause={togglePause}
        onDelete={onDelete}
        brands={brands}
      />
    ),
    [colors, styles, navigation, togglePause, onDelete, brands],
  );

  const listEmpty =
    !showInitialSkeleton && !(error && productAlerts.length === 0) ? (
      <EmptyState
        icon={tab === 'triggered' ? 'flame-outline' : 'notifications-outline'}
        title={tab === 'triggered' ? 'No Triggered Alerts' : 'No Alerts'}
        body={
          tab === 'triggered'
            ? 'Matched deals will appear here when your conditions are met.'
            : 'Enter a product URL above to create your first sale alert.'
        }
      />
    ) : null;

  return (
    <Screen style={styles.root}>
      <TopAppBar title="Sale Alerts" showBack titleAlign="left" hideProfile />

      <FlashList
        data={showInitialSkeleton || (error && productAlerts.length === 0) ? [] : visibleItems}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={isLoadingMore ? <PaginationLoader variant="card" /> : null}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, SPACING.four) + 88 },
        ]}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.three }} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        onEndReached={() => loadMore()}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      <Pressable
        style={[styles.fab, { bottom: Math.max(insets.bottom, SPACING.three) + SPACING.two }]}
        onPress={startCreate}
        accessibilityRole="button"
        accessibilityLabel="Create alert">
        <Icon name="add" size={28} color={colors.onPrimary} />
      </Pressable>
    </Screen>
  );
};

export default SaleAlertsScreen;

const createStyles = (colors) =>
  StyleSheet.create({
    root: { flex: 1 },
    content: {
      paddingHorizontal: SPACING.four,
      paddingTop: SPACING.two,
    },
    headerBlock: { gap: SPACING.four, marginBottom: SPACING.three },
    subtitle: { ...TYPOGRAPHY.small, color: colors.textSecondary, lineHeight: 20 },
    urlCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.three,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...SHADOWS.card,
      gap: SPACING.two,
    },
    urlLabel: { ...TYPOGRAPHY.label, color: colors.text },
    urlInput: {
      ...TYPOGRAPHY.default,
      color: colors.text,
      backgroundColor: colors.backgroundElement || colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: RADIUS.button,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.three,
    },
    urlInputError: { borderColor: colors.error },
    urlErrorText: { ...TYPOGRAPHY.small, color: colors.error },
    urlContinue: {
      marginTop: SPACING.one,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.button,
      paddingVertical: SPACING.three,
      minHeight: 48,
    },
    urlContinueDisabled: { opacity: 0.45 },
    urlContinueText: { ...TYPOGRAPHY.label, color: colors.onPrimary, fontSize: 15 },
    fab: {
      position: 'absolute',
      right: SPACING.four,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...SHADOWS.card,
      elevation: 6,
      shadowOpacity: 0.22,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    tabsWrap: { marginHorizontal: -SPACING.four, flexGrow: 0 },
    tabs: {
      gap: SPACING.two,
      paddingHorizontal: SPACING.four,
      paddingRight: SPACING.five,
    },
    skeletonWrap: { gap: SPACING.four },
    skeletonTabs: {
      flexDirection: 'row',
      gap: SPACING.two,
      flexWrap: 'wrap',
    },
    skeletonCardBody: { flex: 1, gap: SPACING.two, minWidth: 0, paddingTop: 2 },
    listGap: { gap: SPACING.three },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.card,
      padding: SPACING.three,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...SHADOWS.card,
    },
    cardTriggered: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    triggerBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.two,
      marginBottom: SPACING.three,
      paddingBottom: SPACING.three,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    triggerBannerText: { ...TYPOGRAPHY.smallBold, color: colors.text, flex: 1, lineHeight: 18 },
    cardMain: { flexDirection: 'row', gap: SPACING.three, alignItems: 'flex-start' },
    thumb: { borderRadius: 14 },
    cardBody: { flex: 1, gap: SPACING.one + 2, minWidth: 0 },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      minHeight: 28,
    },
    cardTitle: { ...TYPOGRAPHY.smallBold, color: colors.text, flex: 1, lineHeight: 20 },
    switch: { transform: [{ scaleX: 0.78 }, { scaleY: 0.78 }] },
    cardMeta: { ...TYPOGRAPHY.small, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      flexWrap: 'wrap',
      marginTop: 2,
    },
    cardPrice: { ...TYPOGRAPHY.smallBold, color: colors.text, fontSize: 16 },
    wasPrice: { ...TYPOGRAPHY.small, color: colors.textSecondary, textDecorationLine: 'line-through' },
    discountPill: {
      backgroundColor: colors.primarySoft,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: RADIUS.chip,
    },
    discountText: { ...TYPOGRAPHY.label, fontSize: 11, color: colors.primary },
    cardCondition: { ...TYPOGRAPHY.small, fontSize: 13, color: colors.primary, lineHeight: 18 },
    badgeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.two,
      flexWrap: 'wrap',
      marginTop: 2,
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: RADIUS.chip,
    },
    dot: { width: 7, height: 7, borderRadius: 4 },
    badgeText: { ...TYPOGRAPHY.label, fontSize: 11 },
    notifyText: { ...TYPOGRAPHY.small, fontSize: 12, color: colors.textSecondary },
    checkedText: { ...TYPOGRAPHY.small, fontSize: 11, color: colors.mutedInk, marginTop: 2 },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      marginTop: SPACING.three,
      paddingTop: SPACING.three,
      gap: SPACING.four,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 2,
      minHeight: 28,
    },
    actionText: { ...TYPOGRAPHY.label, color: colors.text, fontSize: 13 },
    viewDealBtn: {
      marginLeft: 'auto',
      backgroundColor: colors.primary,
      paddingHorizontal: SPACING.three,
      paddingVertical: SPACING.two,
      borderRadius: RADIUS.chip,
      minHeight: 32,
    },
    viewDealText: { ...TYPOGRAPHY.label, color: colors.onPrimary, fontSize: 13 },
  });
