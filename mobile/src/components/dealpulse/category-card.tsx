import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Shadow, Spacing } from '@/constants/theme';
import { CategoryInfo } from '@/types/dealpulse';

import { usePressScale } from './use-press-scale';

interface Props {
  category: CategoryInfo;
  onPress?: () => void;
  variant?: 'default' | 'compact';
  style?: StyleProp<ViewStyle>;
}

const TILE_COLORS: Record<string, { bg: string; fg: string }> = {
  'tshirt-crew-outline': { bg: '#FBE2E2', fg: '#B7131A' },
  laptop: { bg: '#F6EFD8', fg: '#8A6D1F' },
  'face-woman-outline': { bg: '#DCE6F5', fg: '#1F3A6D' },
  'silverware-fork-knife': { bg: '#FBE2E2', fg: '#B7131A' },
  airplane: { bg: '#DDF0EE', fg: '#147D74' },
  basketball: { bg: '#FCE8D6', fg: '#C2650A' },
  'sofa-outline': { bg: '#E1F0E1', fg: '#1F6D3A' },
  'controller-classic-outline': { bg: '#EDE1F5', fg: '#5A1F6D' },
};
const DEFAULT_TILE_COLORS = { bg: '#F0F0F0', fg: '#6B7280' };

export function CategoryCard({ category, onPress, variant = 'default', style }: Props) {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const compact = variant === 'compact';
  const tile = TILE_COLORS[category.icon] ?? DEFAULT_TILE_COLORS;

  return (
    <Animated.View style={[animatedStyle, styles.wrapper, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={[styles.card, compact ? styles.cardCompact : styles.cardDefault]}>
        {compact && (
          <MaterialCommunityIcons
            name={category.icon as never}
            size={110}
            color="rgba(23,23,23,0.05)"
            style={styles.watermark}
          />
        )}

        {compact ? (
          <View style={[styles.iconBadge, { backgroundColor: tile.bg }]}>
            <MaterialCommunityIcons name={category.icon as never} size={20} color={tile.fg} />
          </View>
        ) : (
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name={category.icon as never} size={24} color="#B7131A" />
          </View>
        )}

        <ThemedText type="smallBold" style={styles.name}>
          {category.name}
        </ThemedText>

        {compact ? (
          <ThemedText type="small" style={[styles.compactCount, { color: tile.fg }]}>
            {category.dealCount.toLocaleString()} Deals
          </ThemedText>
        ) : (
          <View style={styles.countChip}>
            <ThemedText type="small" themeColor="textSecondary">
              {category.dealCount.toLocaleString()} deals
            </ThemedText>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexBasis: '47%',
    borderRadius: Radius.card,
    ...Shadow.card,
  },
  card: {
    borderRadius: Radius.card,
    padding: Spacing.three,
    gap: 4,
  },
  cardCompact: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DADA',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 148,
  },
  cardDefault: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DADA',
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  watermark: {
    position: 'absolute',
    bottom: -18,
    right: -16,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  name: {
    fontSize: 16,
  },
  compactCount: {
    fontSize: 13,
  },
  countChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: Radius.chip,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    marginTop: 2,
  },
});
