import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import { usePressScale } from '../hooks/usePressScale';

const TILE_COLORS = {
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

const CategoryCard = ({ category, onPress, variant = 'default', style }) => {
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
          <Icon name={category.icon} size={110} color="rgba(23,23,23,0.05)" style={styles.watermark} />
        )}

        {compact ? (
          <View style={[styles.iconBadge, { backgroundColor: tile.bg }]}>
            <Icon name={category.icon} size={20} color={tile.fg} />
          </View>
        ) : (
          <View style={styles.iconCircle}>
            <Icon name={category.icon} size={24} color="#B7131A" />
          </View>
        )}

        <Text style={styles.name}>{category.name}</Text>

        {compact ? (
          <Text style={[styles.compactCount, { color: tile.fg }]}>{category.dealCount.toLocaleString()} Deals</Text>
        ) : (
          <View style={styles.countChip}>
            <Text style={styles.countText}>{category.dealCount.toLocaleString()} deals</Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
};

export default CategoryCard;

const styles = StyleSheet.create({
  wrapper: {
    flexBasis: '47%',
    borderRadius: RADIUS.card,
    ...SHADOWS.card,
  },
  card: {
    borderRadius: RADIUS.card,
    padding: SPACING.three,
    gap: 4,
  },
  cardCompact: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DADA',
    paddingVertical: SPACING.four,
    paddingHorizontal: SPACING.three,
    gap: SPACING.one,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 148,
  },
  cardDefault: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0DADA',
    alignItems: 'center',
    paddingVertical: SPACING.four,
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
    marginBottom: SPACING.four,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.one,
  },
  name: {
    ...TYPOGRAPHY.smallBold,
    fontSize: 16,
  },
  compactCount: {
    ...TYPOGRAPHY.small,
    fontSize: 13,
  },
  countChip: {
    backgroundColor: '#F0F0F0',
    borderRadius: RADIUS.chip,
    paddingHorizontal: SPACING.two,
    paddingVertical: 2,
    marginTop: 2,
  },
  countText: {
    ...TYPOGRAPHY.small,
    color: '#6B7280',
  },
});
