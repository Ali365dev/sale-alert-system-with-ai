import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { isDiscountCondition, shortConditionLabel } from '@/state/alerts';
import { TrackedAlert } from '@/types/dealpulse';

import { BrandLogo } from './brand-logo';

interface Props {
  alert: TrackedAlert;
  onDelete: () => void;
  onToggleTriggered: () => void;
}

function ActionIcon({
  name,
  active,
  onPress,
}: {
  name: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={4}>
      <View style={[styles.actionIcon, active && styles.actionIconActive]}>
        <Ionicons name={name} size={16} color={active ? '#FFFFFF' : '#171717'} />
      </View>
    </Pressable>
  );
}

export function TrackedAlertCard({ alert, onDelete, onToggleTriggered }: Props) {
  const name = alert.type === 'product' ? alert.productName ?? alert.brandName : alert.brandName;
  const triggered = alert.status === 'triggered';
  const discount = isDiscountCondition(alert.condition);

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        {alert.image ? (
          <Image source={{ uri: alert.image }} style={styles.image} contentFit="cover" />
        ) : (
          <BrandLogo initials={alert.brandName.slice(0, 2).toUpperCase()} size={48} tone="filled" />
        )}
        <View style={styles.textBlock}>
          <View style={styles.titleRow}>
            <ThemedText type="smallBold" numberOfLines={1} style={styles.title}>
              {name}
            </ThemedText>
            <View style={[styles.badge, triggered && styles.badgeTriggered]}>
              <ThemedText type="label" style={triggered ? styles.badgeLabelTriggered : styles.badgeLabel}>
                {triggered ? 'TRIGGERED' : 'ACTIVE'}
              </ThemedText>
            </View>
          </View>
          {(alert.type === 'brand' || alert.currentPrice != null) && (
            <ThemedText type="small" themeColor="textSecondary">
              {alert.type === 'product' ? `Current: $${alert.currentPrice!.toFixed(2)}` : 'Brand Alert'}
            </ThemedText>
          )}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.conditionRow}>
        <ThemedText type="small" themeColor="textSecondary">
          {alert.type === 'product' ? 'Target:' : 'Condition:'}
        </ThemedText>
        <View style={[styles.conditionPill, discount && styles.conditionPillDiscount]}>
          <ThemedText type="label">{shortConditionLabel(alert.condition, alert.conditionValue)}</ThemedText>
        </View>
      </View>

      <View style={styles.actionRow}>
        <ActionIcon name="pencil-outline" />
        <ActionIcon
          name={triggered ? 'refresh-outline' : 'flash-outline'}
          active={triggered}
          onPress={onToggleTriggered}
        />
        <ActionIcon name="trash-outline" onPress={onDelete} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: Radius.card,
    borderWidth: 1,
    borderColor: '#F0DADA',
    padding: Spacing.three,
    ...Shadow.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  image: {
    width: 48,
    height: 48,
    borderRadius: Radius.button,
    backgroundColor: '#EDEDED',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
  },
  badge: {
    backgroundColor: '#D7E4EC',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.chip,
  },
  badgeTriggered: {
    backgroundColor: '#F5CB1B',
  },
  badgeLabel: {
    color: '#5A666D',
    fontSize: 10,
  },
  badgeLabelTriggered: {
    color: '#171717',
    fontSize: 10,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0DADA',
    marginVertical: Spacing.two,
  },
  conditionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  conditionPill: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.chip,
  },
  conditionPillDiscount: {
    backgroundColor: '#F5CB1B',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  actionIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.button,
    borderWidth: 1,
    borderColor: '#F0DADA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconActive: {
    backgroundColor: '#B7131A',
    borderColor: '#B7131A',
  },
});
