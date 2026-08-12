import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { useCountdown } from '@/hooks/use-countdown';
import { Deal } from '@/types/dealpulse';

import { AnimatedImage, dealImageTag } from './animated-image';
import { usePressScale } from './use-press-scale';

interface Props {
  deal: Deal;
  onPress?: () => void;
}

function dealBadgeLabel(deal: Deal): string {
  return deal.isPercentageOff ? `${deal.discountLabel.replace('-', '')} OFF` : deal.discountLabel;
}

export function ExpiringSoonCard({ deal, onPress }: Props) {
  const countdown = useCountdown(deal.expiresAt);
  const { animatedStyle, onPressIn, onPressOut } = usePressScale(0.98);

  return (
    <Animated.View style={[animatedStyle, styles.card]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.pressable}>
        <AnimatedImage
          source={{ uri: deal.image }}
          style={styles.image}
          contentFit="cover"
          sharedTransitionTag={dealImageTag(deal.id)}
        />
        <View style={styles.body}>
          <ThemedText type="smallBold" numberOfLines={2}>
            {deal.title}
          </ThemedText>
          <View style={styles.badge}>
            <ThemedText type="label" style={styles.badgeLabel}>
              {dealBadgeLabel(deal)}
            </ThemedText>
          </View>
          <View style={styles.timerRow}>
            <Ionicons name="time-outline" size={14} color="#B7131A" />
            <ThemedText type="small" style={styles.timerLabel}>
              {countdown}
            </ThemedText>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    ...Shadow.card,
  },
  pressable: {
    flexDirection: 'row',
    gap: Spacing.three,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DADA',
    borderRadius: Radius.card,
    padding: Spacing.two,
  },
  image: {
    width: 72,
    height: 72,
    borderRadius: Radius.button,
    backgroundColor: '#171717',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F7D9D9',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.chip,
  },
  badgeLabel: {
    color: '#B7131A',
    fontSize: 11,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timerLabel: {
    color: '#B7131A',
  },
});
