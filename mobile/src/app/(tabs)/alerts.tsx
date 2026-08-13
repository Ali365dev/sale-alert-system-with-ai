import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AlertStatTile } from '@/components/dealpulse/alert-stat-tile';
import { AnimatedListItem } from '@/components/dealpulse/animated-list-item';
import { EmptyState } from '@/components/dealpulse/empty-state';
import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { TopAppBar } from '@/components/dealpulse/top-app-bar';
import { TrackedAlertCard } from '@/components/dealpulse/tracked-alert-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Colors, Radius, Spacing } from '@/constants/theme';
import { shortConditionLabel, useAlerts } from '@/state/alerts';
import { TrackedAlert } from '@/types/dealpulse';

export default function AlertsDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { alerts, removeAlert, toggleTriggered } = useAlerts();

  const stats = useMemo(() => {
    const products = new Set(alerts.filter((a) => a.type === 'product').map((a) => a.id)).size;
    const brands = new Set(alerts.map((a) => a.brandName)).size;
    const triggered = alerts.filter((a) => a.status === 'triggered').length;
    return { active: alerts.length, products, brands, triggered };
  }, [alerts]);

  const recentlyTriggered = useMemo(
    () => alerts.find((a) => a.status === 'triggered') ?? null,
    [alerts]
  );

  const topSection = (
    <View style={styles.header}>
      <ThemedText type="title" style={styles.title}>
        Sale Alerts
      </ThemedText>
      <ThemedText type="default" themeColor="textSecondary" style={styles.subtitle}>
        Get notified when your favorite products or brands go on sale.
      </ThemedText>
       {alerts.length !== 0 ? (
      <PrimaryButton
        label="Create Alert"
        icon="add"
        iconPosition="left"
        pill
        onPress={() => router.push('/create-alert')}
        style={styles.createButton}
      />) : null}
    </View>
  );

  const statsSection = (
    <View>
      <View style={styles.statGrid}>
        <AlertStatTile icon="notifications" value={stats.active} label="Active Alerts" tone="primary" />
        <AlertStatTile icon="file-tray-stacked-outline" value={stats.products} label="Products" />
        <AlertStatTile icon="storefront-outline" value={stats.brands} label="Brands" />
        <AlertStatTile icon="flash" value={stats.triggered} label="Triggered" tone="accent" />
      </View>

      {recentlyTriggered && (
        <View style={styles.triggeredBanner}>
          <View style={styles.triggeredHeader}>
            <View style={styles.triggeredBadge}>
              <Ionicons name="flash" size={14} color="#F5CB1B" />
            </View>
            <ThemedText type="label" style={styles.triggeredLabel}>
              RECENTLY TRIGGERED
            </ThemedText>
          </View>
          <View style={styles.triggeredBottomRow}>
            <ThemedText type="default" style={styles.triggeredMessage}>
              {recentlyTriggered.productName ?? recentlyTriggered.brandName} is now{' '}
              <ThemedText type="smallBold">
                {shortConditionLabel(recentlyTriggered.condition, recentlyTriggered.conditionValue)}
              </ThemedText>
            </ThemedText>
            <Pressable
              style={styles.viewDealButton}
              onPress={() =>
                recentlyTriggered.brandId && router.push(`/brand/${recentlyTriggered.brandId}`)
              }>
              <ThemedText type="label" style={styles.viewDealLabel}>
                View Deal
              </ThemedText>
            </Pressable>
          </View>
        </View>
      )}

      <ThemedText type="subtitle" style={styles.manageTitle}>
        Manage Alerts
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <TopAppBar rightIcon="notifications-outline" onPressRight={() => router.push('/notifications')} />

      {alerts.length === 0 ? (
        <ScrollView
          contentContainerStyle={[
            styles.emptyWrap,
            { paddingBottom: insets.bottom + BottomTabInset },
          ]}
          showsVerticalScrollIndicator={false}>
          {topSection}
          <EmptyState
            icon="pricetag-outline"
            title="No alerts yet"
            body="Track a product or brand to get notified the moment it goes on sale."
            ctaLabel="Create Alert"
            onPressCta={() => router.push('/create-alert')}
          />
        </ScrollView>
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(a) => a.id}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + BottomTabInset },
          ]}
          ListHeaderComponent={
            <>
              {topSection}
              {statsSection}
            </>
          }
          renderItem={({ item, index }: { item: TrackedAlert; index: number }) => (
            <AnimatedListItem index={index}>
              <TrackedAlertCard
                alert={item}
                onDelete={() => removeAlert(item.id)}
                onToggleTriggered={() => toggleTriggered(item.id)}
              />
            </AnimatedListItem>
          )}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.backgroundElement,
  },
  emptyWrap: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  header: {
    marginBottom: Spacing.two,
  },
  title: {
    marginBottom: 2,
  },
  subtitle: {
    marginBottom: Spacing.three,
  },
  createButton: {
    // alignSelf: 'flex-start',
    width:"50%",
    marginBottom: Spacing.four,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  triggeredBanner: {
    backgroundColor: '#F5CB1B',
    borderRadius: Radius.card,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    gap: Spacing.two,
  },
  triggeredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  triggeredBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggeredLabel: {
    color: '#171717',
    letterSpacing: 0.5,
  },
  triggeredBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  triggeredMessage: {
    flex: 1,
    color: '#171717',
  },
  viewDealButton: {
    backgroundColor: '#171717',
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  viewDealLabel: {
    color: '#FFFFFF',
  },
  manageTitle: {
    marginBottom: Spacing.one,
  },
});
