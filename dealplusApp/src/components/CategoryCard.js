import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { RADIUS, SHADOWS, SPACING, TYPOGRAPHY } from '../styles/theme';
import useTheme from '../hooks/useTheme';
import { usePressScale } from '../hooks/usePressScale';

// Decorative per-category accent tiles — deliberately theme-invariant (like a
// calendar's category colors), since darkening each pastel individually would
// need a hand-picked dark variant per tile with little practical benefit.
const TILE_COLORS = {
  'shoe-sneaker': { bg: '#EAF8F1', fg: '#16A36A' },
  'tshirt-crew-outline': { bg: '#FFF0F3', fg: '#F20D38' },
  laptop: { bg: '#EEF4FF', fg: '#3478F6' },
  'face-woman-outline': { bg: '#FDECEF', fg: '#D90832' },
  'silverware-fork-knife': { bg: '#FFF6DF', fg: '#F5A623' },
  airplane: { bg: '#EEF4FF', fg: '#4D5F7E' },
  basketball: { bg: '#FFF6DF', fg: '#F5A623' },
  'sofa-outline': { bg: '#EAF8F1', fg: '#006670' },
  'controller-classic-outline': { bg: '#FDECEF', fg: '#F20D38' },
};

const CategoryCard = ({ category, onPress, variant = 'default', style }) => {
  const { animatedStyle, onPressIn, onPressOut } = usePressScale();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const compact = variant === 'compact';
  const circle = variant === 'circle';
  const tile = TILE_COLORS[category.icon] ?? { bg: colors.backgroundElement, fg: colors.textSecondary };
  const count = Number(category.dealCount) || 0;
  const dealLabel =
    count <= 0 ? 'Coming soon' : `${count.toLocaleString()} ${count === 1 ? 'deal' : 'deals'}`;

  if (circle) {
    return (
      <Animated.View style={[animatedStyle, style]}>
        <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={styles.circleCard}>
          <View style={[styles.circleIconWrap, { backgroundColor: tile.bg }]}>
            <Icon name={category.icon} size={26} color={tile.fg} />
          </View>
          <Text style={styles.circleName} numberOfLines={2}>
            {category.name}
          </Text>
        </Pressable>
      </Animated.View>
    );
  }

  if (compact) {
    return (
      <Animated.View style={[animatedStyle, styles.wrapper, style]}>
        <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={[styles.card, styles.cardCompact]}>
          <Icon
            name={category.icon}
            size={110}
            color={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(23,23,23,0.05)'}
            style={styles.watermark}
          />
          <View style={[styles.iconBadge, { backgroundColor: tile.bg }]}>
            <Icon name={category.icon} size={20} color={tile.fg} />
          </View>
          <Text style={styles.name}>{category.name}</Text>
          <Text style={[styles.compactCount, { color: tile.fg }]}>{dealLabel}</Text>
        </Pressable>
      </Animated.View>
    );
  }

  // Default — centered icon tile matching Categories screen mock
  return (
    <Animated.View style={[animatedStyle, styles.wrapper, style]}>
      <Pressable onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut} style={[styles.card, styles.cardDefault]}>
        <View style={styles.iconCircle}>
          <Icon name={category.icon || 'tag-outline'} size={28} color={colors.primary} />
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {category.name}
        </Text>
        <View style={[styles.countChip, count <= 0 && styles.countChipMuted]}>
          <Text style={[styles.countText, count <= 0 && styles.countTextMuted]}>{dealLabel}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default CategoryCard;

const createStyles = (colors) =>
  StyleSheet.create({
    wrapper: {
      flexBasis: '47%',
      borderRadius: 20,
      ...SHADOWS.card,
    },
    card: {
      borderRadius: 20,
      padding: SPACING.three,
      gap: 4,
      backgroundColor: colors.surface,
    },
    cardCompact: {
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: SPACING.four,
      paddingHorizontal: SPACING.three,
      gap: SPACING.one,
      overflow: 'hidden',
      position: 'relative',
      minHeight: 148,
    },
    cardDefault: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 22,
      paddingHorizontal: 14,
      gap: 10,
      minHeight: 168,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
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
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
      textAlign: 'center',
      alignSelf: 'stretch',
      paddingHorizontal: 4,
    },
    compactCount: {
      ...TYPOGRAPHY.small,
      fontSize: 13,
    },
    countChip: {
      backgroundColor: colors.primarySoft,
      borderRadius: RADIUS.chip,
      paddingHorizontal: 12,
      paddingVertical: 5,
      marginTop: 2,
    },
    countChipMuted: {
      backgroundColor: colors.backgroundElement,
    },
    countText: {
      ...TYPOGRAPHY.small,
      fontSize: 12,
      fontWeight: '700',
      color: colors.primary,
    },
    countTextMuted: {
      color: colors.textSecondary,
      fontWeight: '600',
    },
    circleCard: {
      alignItems: 'center',
      width: 88,
      gap: 2,
    },
    circleIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.one,
    },
    circleName: {
      ...TYPOGRAPHY.smallBold,
      color: colors.text,
      textAlign: 'center',
    },
    circleCount: {
      ...TYPOGRAPHY.small,
      fontSize: 11,
      color: colors.textSecondary,
    },
  });
