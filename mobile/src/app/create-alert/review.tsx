import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/dealpulse/primary-button';
import { ProductPreviewCard } from '@/components/dealpulse/product-preview-card';
import { SecondaryButton } from '@/components/dealpulse/secondary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { conditionLabel, useAlerts } from '@/state/alerts';

export default function ReviewSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { alerts } = useAlerts();
  const alert = alerts.find((a) => a.id === id);

  if (!alert) return null;

  const name = alert.type === 'product' ? alert.productName ?? alert.brandName : alert.brandName;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.checkCircle}>
          <Ionicons name="checkmark" size={36} color="#FFFFFF" />
        </View>
        <ThemedText type="title" style={styles.headline}>
          Alert Created!
        </ThemedText>
        <ThemedText type="default" themeColor="textSecondary" style={styles.body}>
          You'll be notified when {name} reaches your selected sale condition.
        </ThemedText>

        <View style={styles.card}>
          <ThemedText type="smallBold" style={styles.cardTitle}>
            Review Your Alert
          </ThemedText>
          <ProductPreviewCard
            image={alert.image}
            name={name ?? ''}
            brandName={alert.brandName}
            currentPrice={alert.currentPrice}
            originalPrice={alert.originalPrice}
          />

          <View style={styles.summaryRow}>
            {alert.currentPrice != null && (
              <View style={styles.summaryTile}>
                <ThemedText type="label" themeColor="textSecondary">
                  CURRENT PRICE
                </ThemedText>
                <ThemedText type="smallBold">${alert.currentPrice.toFixed(2)}</ThemedText>
              </View>
            )}
            <View style={[styles.summaryTile, styles.conditionTile]}>
              <ThemedText type="label" style={styles.conditionLabel}>
                CONDITION
              </ThemedText>
              <ThemedText type="smallBold" style={styles.conditionValue} numberOfLines={1}>
                {conditionLabel(alert.condition, alert.conditionValue)}
              </ThemedText>
            </View>
          </View>

          <View style={styles.notifyRow}>
            <ThemedText type="label" themeColor="textSecondary">
              NOTIFICATIONS
            </ThemedText>
            <View style={styles.notifyIcons}>
              {alert.channels.push && (
                <View style={styles.notifyChip}>
                  <Ionicons name="notifications" size={14} color="#B7131A" />
                  <ThemedText type="small">Push</ThemedText>
                </View>
              )}
              {alert.channels.email && (
                <View style={styles.notifyChip}>
                  <Ionicons name="mail" size={14} color="#B7131A" />
                  <ThemedText type="small">Email</ThemedText>
                </View>
              )}
              {alert.channels.inApp && (
                <View style={styles.notifyChip}>
                  <Ionicons name="phone-portrait" size={14} color="#B7131A" />
                  <ThemedText type="small">In-app</ThemedText>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.three }]}>
        <PrimaryButton
          label="View My Alerts"
          onPress={() => router.replace('/(tabs)/alerts')}
          style={styles.primaryCta}
        />
        <SecondaryButton
          label="Continue Browsing"
          variant="outline"
          onPress={() => router.replace('/(tabs)')}
        />
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
    alignItems: 'center',
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#B7131A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.three,
  },
  headline: {
    color: '#B7131A',
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
    marginTop: Spacing.one,
    marginBottom: Spacing.four,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardTitle: {
    marginBottom: Spacing.one,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  summaryTile: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    borderRadius: Radius.button,
    padding: Spacing.two,
    gap: 2,
  },
  conditionTile: {
    backgroundColor: '#B7131A',
  },
  conditionLabel: {
    color: 'rgba(255,255,255,0.8)',
  },
  conditionValue: {
    color: '#FFFFFF',
  },
  notifyRow: {
    gap: Spacing.one,
  },
  notifyIcons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  notifyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8F9FB',
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
  },
  footer: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  primaryCta: {
    marginBottom: 0,
  },
});
